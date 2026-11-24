import { generateWikiId, twTimestamp, debounce, escapeHtml } from '../core/utils.js';
import { t } from '../core/i18n.js';
import { TiddlerStore } from '../core/store.js';
import { runFilter } from '../core/filter.js';
import { expandTemplatePlaceholders } from '../core/parser.js';
import { isEncryptedEnvelope, encryptStorePayload, encryptWithDerivedKey, decryptStoreEnvelope } from '../core/crypto.js';
import { exportJson, importJson, importTid, importMarkdown, importHtml, importCsv } from '../core/formats.js';
import { serializeFromDocument } from '../storage/serializer.js';
import { saveBackup, loadBackup, clearBackup, saveHtmlToDisk, shareHtmlMobile, downloadTextFile } from '../storage/persistence.js';
import { SHADOW_TIDDLERS, createStarterTiddlers } from '../seed/starter-tiddlers.js';
import { getPackById, buildEditionStoreData, mergePackIntoStore } from '../packs/index.js';
import { icon } from './icons.js';
import { applyThemeFromStore, getWikiLang } from './theme.js';
import { showToast, openCommandPalette, openImportModal, openModesModal, renderUnlockScreen } from './modals.js';
import { renderRiver } from './river.js';
import { renderSidebar } from './sidebar.js';
import { openGraphModal } from './graph.js';

function readEmbeddedStore() {
  const el = document.getElementById('tidly-store');
  if (!el || !el.textContent) return null;
  try {
    return JSON.parse(el.textContent);
  } catch {
    return null;
  }
}

export async function bootApp() {
  const root = document.getElementById('app');
  if (!root) return;

  const fileSnapshot = readEmbeddedStore() || {
    v: 1,
    wikiId: generateWikiId(),
    updatedAt: twTimestamp(),
    tiddlers: createStarterTiddlers()
  };

  const wikiId = fileSnapshot.wikiId || (fileSnapshot.meta && fileSnapshot.meta.wikiId) || generateWikiId();
  const localSnapshot = await loadBackup(wikiId);

  const fileTs = fileSnapshot.updatedAt || (fileSnapshot.meta && fileSnapshot.meta.updatedAt) || '';
  const localTs = localSnapshot ? (localSnapshot.updatedAt || (localSnapshot.meta && localSnapshot.meta.updatedAt) || '') : '';
  const useBackup = Boolean(localSnapshot && localTs > fileTs);
  let activeSnapshot = useBackup ? localSnapshot : fileSnapshot;

  const cryptoSession = {
    enabled: false,
    key: null,
    salt: null,
    iterations: 250000
  };

  let restoredFromBackup = useBackup;

  const startWorkspace = (plainPayload) => {
    const store = new TiddlerStore({
      tiddlers: Array.isArray(plainPayload.tiddlers) ? plainPayload.tiddlers : createStarterTiddlers(),
      shadows: SHADOW_TIDDLERS
    });
    if (restoredFromBackup) {
      // Mark dirty so Save indicator reflects unpersisted HTML changes
      store._dirty = true;
    }

    const state = {
      openCards: [],
      activeCard: '',
      editing: new Set(),
      folded: new Set(),
      infoOpen: new Set(),
      sidebarTab: 'open',
      filterExpr: '[all[tiddlers]sort[title]]',
      sidebarCollapsed: false,
      mobileDrawerOpen: false,
      fsaHandle: null
    };

    const resolveInitialCards = () => {
      const hashTitle = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : '';
      const defExpr = store.getText('$:/DefaultTiddlers', '[[Hoş Geldiniz]]');
      const defaults = runFilter(defExpr, store).titles;
      const list = [];
      if (hashTitle && store.has(hashTitle)) list.push(hashTitle);
      for (const title of defaults) {
        if (!list.includes(title) && store.has(title)) list.push(title);
      }
      if (!list.length) {
        const first = store.getAll({ includeSystem: false })[0];
        if (first) list.push(first.title);
      }
      state.openCards = list;
      state.activeCard = list[0] || '';
    };

    const buildPlainPayload = () => ({
      v: 1,
      wikiId,
      updatedAt: twTimestamp(),
      tiddlers: store.getUserTiddlers()
    });

    const buildExportSnapshot = async () => {
      const plain = buildPlainPayload();
      if (cryptoSession.enabled && cryptoSession.key) {
        const meta = {
          wikiId,
          updatedAt: plain.updatedAt,
          lang: getWikiLang(store),
          palette: store.getText('$:/Palette', 'paper').trim()
        };
        return encryptWithDerivedKey(plain, cryptoSession.key, cryptoSession.salt, meta, cryptoSession.iterations);
      }
      return plain;
    };

    const debouncedBackup = debounce(async () => {
      const snap = await buildExportSnapshot();
      await saveBackup(wikiId, snap);
    }, 400);

    const app = {
      store,
      lang: () => getWikiLang(store),
      isDirty: () => store.isDirty(),
      isEncrypted: () => cryptoSession.enabled,
      getOpenCards: () => [...state.openCards],
      getActiveCard: () => state.activeCard,
      setActiveCard: (title) => {
        state.activeCard = title;
      },
      isEditing: (title) => state.editing.has(title),
      isFolded: (title) => state.folded.has(title),
      isInfoOpen: (title) => state.infoOpen.has(title),
      getSidebarTab: () => state.sidebarTab,
      getFilterExpr: () => state.filterExpr,
      setFilterExprQuiet: (expr) => { state.filterExpr = expr; },

      setSidebarTab: (tabId) => {
        state.sidebarTab = tabId;
        app.render();
      },

      setFilterSearch: (expr) => {
        state.filterExpr = expr;
        state.sidebarTab = 'filter';
        if (window.innerWidth <= 767) state.mobileDrawerOpen = true;
        else state.sidebarCollapsed = false;
        app.render();
      },

      openCard: (title, { focus = true, edit = false } = {}) => {
        if (!title) return;
        if (!state.openCards.includes(title)) {
          state.openCards.unshift(title);
        }
        state.folded.delete(title);
        if (focus) state.activeCard = title;
        if (edit) state.editing.add(title);
        app.render();
      },

      closeCard: (title) => {
        state.openCards = state.openCards.filter((x) => x !== title);
        state.editing.delete(title);
        if (state.activeCard === title) {
          state.activeCard = state.openCards[0] || '';
        }
        app.render();
      },

      closeAllCards: () => {
        state.openCards = [];
        state.editing.clear();
        state.activeCard = '';
        app.render();
      },

      openDefaultCards: () => {
        resolveInitialCards();
        app.render();
      },

      moveCard: (title, delta) => {
        const idx = state.openCards.indexOf(title);
        const nextIdx = idx + delta;
        if (idx < 0 || nextIdx < 0 || nextIdx >= state.openCards.length) return;
        const copy = [...state.openCards];
        const tmp = copy[idx];
        copy[idx] = copy[nextIdx];
        copy[nextIdx] = tmp;
        state.openCards = copy;
        app.render();
      },

      toggleFold: (title) => {
        if (state.folded.has(title)) state.folded.delete(title);
        else state.folded.add(title);
        app.render();
      },

      toggleInfo: (title) => {
        if (state.infoOpen.has(title)) state.infoOpen.delete(title);
        else state.infoOpen.add(title);
        app.render();
      },

      startEdit: (title) => {
        if (!state.openCards.includes(title)) state.openCards.unshift(title);
        state.folded.delete(title);
        state.editing.add(title);
        state.activeCard = title;
        app.render();
      },

      cancelEdit: (title) => {
        state.editing.delete(title);
        app.render();
      },

      saveEdit: (originalTitle, nextTiddler) => {
        const exists = store.has(originalTitle);
        if (exists && nextTiddler.title !== originalTitle) {
          store.rename(originalTitle, nextTiddler.title, { updateLinks: true });
          const idx = state.openCards.indexOf(originalTitle);
          if (idx >= 0) state.openCards[idx] = nextTiddler.title;
          if (state.activeCard === originalTitle) state.activeCard = nextTiddler.title;
        }
        store.put(nextTiddler);
        state.editing.delete(originalTitle);
        state.editing.delete(nextTiddler.title);
        state.activeCard = nextTiddler.title;
        app.render();
      },

      renameCard: (oldTitle, newTitle, updateLinks) => {
        store.rename(oldTitle, newTitle, { updateLinks });
        const idx = state.openCards.indexOf(oldTitle);
        if (idx >= 0) state.openCards[idx] = newTitle;
        if (state.activeCard === oldTitle) state.activeCard = newTitle;
        app.render();
      },

      deleteCard: (title) => {
        const lang = app.lang();
        if (!window.confirm(t('confirmDeleteMsg', lang, { title }))) return;
        const deleted = store.delete(title);
        state.openCards = state.openCards.filter((x) => x !== title);
        state.editing.delete(title);
        if (state.activeCard === title) state.activeCard = state.openCards[0] || '';
        app.render();
        if (deleted) {
          showToast(t('deletedToast', lang, { title }), {
            actionLabel: t('undo', lang),
            onAction: () => {
              store.undo();
              app.openCard(title);
            }
          });
        }
      },

      createNewCard: ({ title = '', templateTitle = '', tags = [] } = {}) => {
        const lang = app.lang();
        const base = title || t('untitled', lang);
        let candidate = base;
        let n = 2;
        while (store.has(candidate)) {
          candidate = base + ' ' + n;
          n++;
        }

        let text = '';
        let cardTags = [...tags];
        let fields = {};
        if (templateTitle && store.has(templateTitle)) {
          const tpl = store.get(templateTitle);
          text = expandTemplatePlaceholders(tpl.text, { title: candidate });
          const tplTags = (tpl.tags || []).filter((tg) => tg !== '$:/tags/Template');
          cardTags = Array.from(new Set([...tplTags, ...cardTags]));
          fields = { ...(tpl.fields || {}) };
        }

        store.put({ title: candidate, text, tags: cardTags, fields });
        if (window.innerWidth <= 767) state.mobileDrawerOpen = false;
        app.openCard(candidate, { focus: true, edit: true });
      },

      saveHtml: async () => {
        const lang = app.lang();
        const siteTitle = store.getText('$:/SiteTitle', 'Tidly Notebook');
        const palette = store.getText('$:/Palette', 'paper').trim();
        const snap = await buildExportSnapshot();
        const html = serializeFromDocument(document, snap, { title: siteTitle, lang, palette });
        const slug = siteTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tidly-notebook';
        try {
          const res = await saveHtmlToDisk(html, slug + '.html', state.fsaHandle);
          state.fsaHandle = res.handle;
          store.markClean();
          restoredFromBackup = false;
          await saveBackup(wikiId, snap);
          app.render();
          showToast(res.method === 'fsa' ? t('savedFsaToast', lang) : t('savedDownloadToast', lang));
        } catch (err) {
          if (!err || err.name !== 'AbortError') {
            showToast(err && err.message ? err.message : 'Save failed');
          }
        }
      },

      shareHtml: async () => {
        const lang = app.lang();
        const siteTitle = store.getText('$:/SiteTitle', 'Tidly Notebook');
        const palette = store.getText('$:/Palette', 'paper').trim();
        const snap = await buildExportSnapshot();
        const html = serializeFromDocument(document, snap, { title: siteTitle, lang, palette });
        const method = await shareHtmlMobile(html, 'tidly-notebook.html');
        store.markClean();
        restoredFromBackup = false;
        await saveBackup(wikiId, snap);
        app.render();
        if (method === 'download') showToast(t('savedDownloadToast', lang));
      },

      undo: () => {
        if (store.undo()) app.render();
      },

      redo: () => {
        if (store.redo()) app.render();
      },

      openSearch: () => openCommandPalette(app),
      openGraph: () => openGraphModal(app),
      openModes: () => openModesModal(app),

      applyPack: (packId, mode = 'merge') => {
        const lang = app.lang();
        const pack = getPackById(packId);
        const packName = lang === 'en' ? pack.nameEn : pack.nameTr;
        if (mode === 'clean') {
          const snap = buildEditionStoreData(packId);
          store.loadUserTiddlers(snap.tiddlers, { markDirty: true });
          state.editing.clear();
          state.folded.clear();
          state.infoOpen.clear();
          resolveInitialCards();
          app.render();
          return;
        }
        const added = mergePackIntoStore(store, packId, { applyTheme: true });
        if (window.innerWidth <= 767) state.mobileDrawerOpen = false;
        app.openCard(pack.landingCard, { focus: true });
        showToast(t('modeMergedToast', lang, { mode: packName, count: added.length }));
      },

      downloadEditionHtml: (packId) => {
        const lang = app.lang();
        const pack = getPackById(packId);
        const snap = buildEditionStoreData(packId);
        const html = serializeFromDocument(document, snap, {
          title: pack.siteTitle,
          lang,
          palette: pack.palette
        });
        downloadTextFile(html, pack.filename, 'text/html;charset=utf-8');
      },

      toggleDayNight: () => {
        const cur = store.getText('$:/Palette', 'paper').trim();
        store.put({ title: '$:/Palette', text: cur === 'night' ? 'paper' : 'night', type: 'text/plain' });
        app.render();
      },

      cycleLayout: () => {
        const cur = store.getText('$:/Layout', 'river').trim();
        const order = ['river', 'focus', 'split'];
        const next = order[(order.indexOf(cur) + 1) % order.length];
        store.put({ title: '$:/Layout', text: next, type: 'text/plain' });
        app.render();
      },

      toggleSidebarCollapsed: () => {
        state.sidebarCollapsed = !state.sidebarCollapsed;
        document.body.classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
      },

      openMobileDrawer: () => {
        state.mobileDrawerOpen = true;
        document.body.classList.add('drawer-open');
      },

      closeMobileDrawer: () => {
        state.mobileDrawerOpen = false;
        document.body.classList.remove('drawer-open');
      },

      setPassword: async (pw) => {
        const plain = buildPlainPayload();
        const meta = {
          wikiId,
          updatedAt: plain.updatedAt,
          lang: getWikiLang(store),
          palette: store.getText('$:/Palette', 'paper').trim()
        };
        const res = await encryptStorePayload(plain, pw, meta);
        cryptoSession.enabled = true;
        cryptoSession.key = res.key;
        cryptoSession.salt = res.salt;
        store._dirty = true;
        await saveBackup(wikiId, res.envelope);
        app.render();
        showToast(t('encryptionActive', app.lang()));
      },

      disableEncryption: async () => {
        cryptoSession.enabled = false;
        cryptoSession.key = null;
        cryptoSession.salt = null;
        store._dirty = true;
        await saveBackup(wikiId, buildPlainPayload());
        app.render();
        showToast(t('encryptionInactive', app.lang()));
      },

      exportJsonAll: () => {
        downloadTextFile(exportJson(store.getUserTiddlers()), 'tidly-notebook-backup.json', 'application/json;charset=utf-8');
      },

      handleImportFiles: async (fileList) => {
        const imported = [];
        for (const file of Array.from(fileList)) {
          const text = await file.text();
          const name = file.name || 'import';
          const ext = name.split('.').pop().toLowerCase();
          const baseName = name.replace(/\.[^.]+$/, '');
          try {
            if (ext === 'json') {
              imported.push(...importJson(text));
            } else if (ext === 'tid') {
              imported.push(importTid(text, baseName));
            } else if (ext === 'md' || ext === 'markdown') {
              imported.push(importMarkdown(text, baseName));
            } else if (ext === 'csv') {
              imported.push(importCsv(text, baseName));
            } else if (ext === 'html' || ext === 'htm') {
              const res = importHtml(text);
              if (res.encrypted) {
                showToast(name + ': Şifreli HTML dosyası doğrudan içe aktarılamadı.');
              } else {
                imported.push(...res.tiddlers);
              }
            }
          } catch (err) {
            showToast(name + ': ' + (err && err.message ? err.message : 'Import error'));
          }
        }
        if (imported.length) {
          openImportModal(app, imported, String(imported.length));
        }
      },

      applyImport: (items, conflictMode) => {
        let firstOpened = '';
        for (const item of items) {
          let targetTitle = item.title;
          if (store.has(targetTitle)) {
            if (conflictMode === 'skip') continue;
            if (conflictMode === 'rename') {
              let n = 2;
              while (store.has(item.title + ' (' + n + ')')) n++;
              targetTitle = item.title + ' (' + n + ')';
            }
          }
          store.put({ ...item, title: targetTitle });
          if (!firstOpened && !targetTitle.startsWith('$:/')) firstOpened = targetTitle;
        }
        if (firstOpened) app.openCard(firstOpened);
        else app.render();
      },

      render: () => {
        applyThemeFromStore(store);
        const lang = app.lang();
        const siteTitle = store.getText('$:/SiteTitle', 'Tidly Notebook');
        const dirty = store.isDirty();

        document.body.classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
        document.body.classList.toggle('drawer-open', state.mobileDrawerOpen);

        root.innerHTML =
          '<div class="app-shell">' +
            (restoredFromBackup
              ? '<div class="recovery-banner" role="status">' +
                  '<span>' + escapeHtml(t('backupRestoredMsg', lang)) + '</span>' +
                  '<div class="recovery-actions">' +
                    '<button type="button" class="btn btn-primary btn-sm" data-rec-save>' + escapeHtml(t('backupSaveHtml', lang)) + '</button>' +
                    '<button type="button" class="btn btn-sm" data-rec-revert>' + escapeHtml(t('backupRevertFile', lang)) + '</button>' +
                  '</div>' +
                '</div>'
              : '') +
            '<header class="mobile-topbar">' +
              '<div class="mobile-brand">' +
                '<span class="mobile-brand-text">' + escapeHtml(siteTitle) + '</span>' +
                (dirty ? '<span class="dirty-dot" title="' + escapeHtml(t('unsavedChanges', lang)) + '"></span>' : '') +
              '</div>' +
              '<div class="mobile-top-actions">' +
                '<button type="button" class="icon-btn" data-m-search aria-label="' + escapeHtml(t('search', lang)) + '">' + icon('search', 18) + '</button>' +
                '<button type="button" class="icon-btn" data-m-save aria-label="' + escapeHtml(t('saveHtml', lang)) + '">' + icon('save', 18) + '</button>' +
                '<button type="button" class="icon-btn" data-m-share aria-label="' + escapeHtml(t('shareHtml', lang)) + '">' + icon('share', 18) + '</button>' +
              '</div>' +
            '</header>' +
            '<button type="button" class="btn btn-sm sidebar-toggle-fab" data-fab-side aria-label="' + escapeHtml(t('menu', lang)) + '">' +
              icon('sidebar', 16) + ' <span>' + escapeHtml(t('menu', lang)) + '</span>' +
            '</button>' +
            '<div class="workspace">' +
              '<main class="river-pane" id="tidly-river"></main>' +
              '<aside class="sidebar-pane" id="tidly-sidebar"></aside>' +
            '</div>' +
            '<div class="drawer-backdrop" data-drawer-backdrop></div>' +
            '<nav class="mobile-bottom-nav" aria-label="Mobile navigation">' +
              '<button type="button" class="bottom-nav-btn is-active" data-bn-flow>' + icon('book', 18) + '<span>' + escapeHtml(t('flow', lang)) + '</span></button>' +
              '<button type="button" class="bottom-nav-btn" data-bn-search>' + icon('search', 18) + '<span>' + escapeHtml(t('search', lang)) + '</span></button>' +
              '<button type="button" class="bottom-nav-btn is-create" data-bn-new>' + icon('plus', 20) + '<span>' + escapeHtml(t('newCard', lang)) + '</span></button>' +
              '<button type="button" class="bottom-nav-btn" data-bn-graph>' + icon('graph', 18) + '<span>' + escapeHtml(t('graph', lang)) + '</span></button>' +
              '<button type="button" class="bottom-nav-btn" data-bn-menu>' + icon('menu', 18) + '<span>' + escapeHtml(t('menu', lang)) + '</span></button>' +
            '</nav>' +
          '</div>';

        const riverEl = root.querySelector('#tidly-river');
        const sideEl = root.querySelector('#tidly-sidebar');

        renderRiver(riverEl, app);
        renderSidebar(sideEl, app);

        if (restoredFromBackup) {
          root.querySelector('[data-rec-save]').addEventListener('click', () => app.saveHtml());
          root.querySelector('[data-rec-revert]').addEventListener('click', async () => {
            await clearBackup(wikiId);
            restoredFromBackup = false;
            if (isEncryptedEnvelope(fileSnapshot)) {
              window.location.reload();
              return;
            }
            store.loadUserTiddlers(fileSnapshot.tiddlers || [], { markDirty: false });
            resolveInitialCards();
            app.render();
          });
        }

        root.querySelector('[data-m-search]').addEventListener('click', () => app.openSearch());
        root.querySelector('[data-m-save]').addEventListener('click', () => app.saveHtml());
        root.querySelector('[data-m-share]').addEventListener('click', () => app.shareHtml());
        root.querySelector('[data-fab-side]').addEventListener('click', () => app.toggleSidebarCollapsed());
        root.querySelector('[data-drawer-backdrop]').addEventListener('click', () => app.closeMobileDrawer());

        root.querySelector('[data-bn-flow]').addEventListener('click', () => {
          app.closeMobileDrawer();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        root.querySelector('[data-bn-search]').addEventListener('click', () => app.openSearch());
        root.querySelector('[data-bn-new]').addEventListener('click', () => app.createNewCard());
        root.querySelector('[data-bn-graph]').addEventListener('click', () => app.openGraph());
        root.querySelector('[data-bn-menu]').addEventListener('click', () => {
          if (state.mobileDrawerOpen) app.closeMobileDrawer();
          else app.openMobileDrawer();
        });
      }
    };

    store.subscribe((ev) => {
      if (ev.type !== 'clean') {
        debouncedBackup();
      }
    });

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        app.openSearch();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        app.saveHtml();
      } else if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        app.createNewCard();
      }
    });

    window.addEventListener('hashchange', () => {
      const h = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : '';
      if (h && store.has(h)) app.openCard(h);
    });

    window.addEventListener('beforeunload', (e) => {
      if (store.isDirty()) {
        e.preventDefault();
        e.returnValue = t('leaveWarning', app.lang());
      }
    });

    // Global file drop import
    document.addEventListener('dragover', (e) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
        e.preventDefault();
      }
    });
    document.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        e.preventDefault();
        app.handleImportFiles(e.dataTransfer.files);
      }
    });

    resolveInitialCards();
    app.render();
  };

  if (isEncryptedEnvelope(activeSnapshot)) {
    renderUnlockScreen(root, activeSnapshot, async (password) => {
      const { payload, key, salt } = await decryptStoreEnvelope(activeSnapshot, password);
      cryptoSession.enabled = true;
      cryptoSession.key = key;
      cryptoSession.salt = salt;
      cryptoSession.iterations = Number(activeSnapshot.iterations) || 250000;
      startWorkspace(payload);
    });
  } else {
    startWorkspace(activeSnapshot);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bootApp(); });
  } else {
    bootApp();
  }
}
