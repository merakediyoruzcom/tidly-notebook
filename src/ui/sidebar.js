import { escapeHtml } from '../core/utils.js';
import { t } from '../core/i18n.js';
import { runFilter } from '../core/filter.js';
import { renderWikiText } from '../core/parser.js';
import { exportJson } from '../core/formats.js';
import { downloadTextFile } from '../storage/persistence.js';
import { icon } from './icons.js';
import { wireInteractiveWidgets } from './widgets.js';
import { openEncryptionModal, showToast } from './modals.js';
import { wireWikiContentInteractions } from './river.js';

export function renderSidebar(container, app) {
  const lang = app.lang();
  const siteTitle = app.store.getText('$:/SiteTitle', 'Tidly Notebook');
  const siteSubtitle = app.store.getText('$:/SiteSubtitle', '');
  const activeTab = app.getSidebarTab();
  const dirty = app.isDirty();

  const templates = Array.from(new Set([
    ...runFilter('[all[tiddlers]tag[$:/tags/Template]sort[title]]', app.store).titles,
    ...runFilter('[all[system]tag[$:/tags/Template]sort[title]]', app.store).titles
  ]));

  const userSidebarTabs = Array.from(new Set([
    ...runFilter('[all[tiddlers]tag[$:/tags/SideBar]sort[title]]', app.store).titles,
    ...runFilter('[all[system]tag[$:/tags/SideBar]sort[title]]', app.store).titles
  ]));

  container.innerHTML = '';

  // Header
  const head = document.createElement('div');
  head.className = 'sidebar-head';
  head.innerHTML =
    '<div class="sidebar-brand-row">' +
      '<div style="min-width:0;">' +
        '<h1 class="sidebar-title">' + escapeHtml(siteTitle) + '</h1>' +
        (siteSubtitle ? '<p class="sidebar-subtitle">' + escapeHtml(siteSubtitle) + '</p>' : '') +
      '</div>' +
      '<button type="button" class="icon-btn" data-side-collapse aria-label="' + escapeHtml(t('close', lang)) + '">' +
        icon('close', 18) +
      '</button>' +
    '</div>' +
    '<button type="button" class="input" data-side-search style="text-align:left;color:var(--muted);display:flex;align-items:center;gap:8px;cursor:pointer;">' +
      icon('search', 16) + '<span>' + escapeHtml(t('searchPlaceholder', lang)) + '</span>' +
    '</button>' +
    '<div class="sidebar-action-bar">' +
      '<div class="template-menu-wrap" style="display:inline-flex;">' +
        '<button type="button" class="btn btn-primary btn-sm" data-side-new>' + icon('plus', 15) + ' <span>' + escapeHtml(t('newCard', lang)) + '</span></button>' +
        '<button type="button" class="btn btn-sm" data-side-tpl-toggle aria-label="' + escapeHtml(t('newFromTemplate', lang)) + '" style="margin-left:2px;">▾</button>' +
        '<div class="template-dropdown" data-tpl-menu style="display:none;"></div>' +
      '</div>' +
      '<button type="button" class="btn btn-sm" data-side-save>' +
        (dirty ? '<span class="dirty-dot" title="' + escapeHtml(t('unsavedChanges', lang)) + '"></span>' : '') +
        icon('save', 15) + ' <span>' + escapeHtml(t('saveHtml', lang)) + '</span>' +
      '</button>' +
      '<button type="button" class="btn btn-sm" data-side-modes title="' + escapeHtml(t('modesTitle', lang)) + '">' +
        icon('layers', 15) + ' <span>' + escapeHtml(t('modesBtn', lang)) + '</span>' +
      '</button>' +
      '<button type="button" class="icon-btn" data-side-undo title="' + escapeHtml(t('undo', lang)) + '"' + (app.store.canUndo() ? '' : ' disabled') + '>' + icon('undo', 16) + '</button>' +
      '<button type="button" class="icon-btn" data-side-redo title="' + escapeHtml(t('redo', lang)) + '"' + (app.store.canRedo() ? '' : ' disabled') + '>' + icon('redo', 16) + '</button>' +
      '<button type="button" class="icon-btn" data-side-graph title="' + escapeHtml(t('graph', lang)) + '">' + icon('graph', 16) + '</button>' +
    '</div>';

  container.appendChild(head);

  head.querySelector('[data-side-collapse]').addEventListener('click', () => {
    if (window.innerWidth <= 767) app.closeMobileDrawer();
    else app.toggleSidebarCollapsed();
  });
  head.querySelector('[data-side-search]').addEventListener('click', () => app.openSearch());
  head.querySelector('[data-side-new]').addEventListener('click', () => app.createNewCard());
  head.querySelector('[data-side-save]').addEventListener('click', () => app.saveHtml());
  head.querySelector('[data-side-modes]').addEventListener('click', () => app.openModes());
  head.querySelector('[data-side-undo]').addEventListener('click', () => app.undo());
  head.querySelector('[data-side-redo]').addEventListener('click', () => app.redo());
  head.querySelector('[data-side-graph]').addEventListener('click', () => app.openGraph());

  const tplMenu = head.querySelector('[data-tpl-menu]');
  const tplToggle = head.querySelector('[data-side-tpl-toggle]');
  if (!templates.length) {
    tplMenu.innerHTML = '<div class="muted" style="padding:8px;">' + escapeHtml(t('noTemplates', lang)) + '</div>';
  } else {
    for (const tplTitle of templates) {
      const opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'template-opt';
      opt.textContent = tplTitle;
      opt.addEventListener('click', () => {
        tplMenu.style.display = 'none';
        app.createNewCard({ templateTitle: tplTitle });
      });
      tplMenu.appendChild(opt);
    }
  }
  tplToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    tplMenu.style.display = tplMenu.style.display === 'none' ? 'block' : 'none';
  });

  // Tabs bar
  const tabsBar = document.createElement('div');
  tabsBar.className = 'sidebar-tabs';
  tabsBar.setAttribute('role', 'tablist');

  const tabs = [
    { id: 'open', label: t('tabOpen', lang) },
    { id: 'recent', label: t('tabRecent', lang) },
    { id: 'tags', label: t('tabTags', lang) },
    { id: 'filter', label: t('tabFilter', lang) },
    { id: 'system', label: t('tabSystem', lang) },
    { id: 'settings', label: t('tabSettings', lang) }
  ];
  for (const title of userSidebarTabs) {
    const card = app.store.get(title);
    const caption = card && card.fields && card.fields.caption ? card.fields.caption : title;
    tabs.push({ id: 'user:' + title, label: caption, cardTitle: title });
  }

  for (const tab of tabs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab-btn' + (activeTab === tab.id ? ' is-active' : '');
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', activeTab === tab.id ? 'true' : 'false');
    btn.textContent = tab.label;
    btn.addEventListener('click', () => app.setSidebarTab(tab.id));
    tabsBar.appendChild(btn);
  }
  container.appendChild(tabsBar);

  // Tab body
  const body = document.createElement('div');
  body.className = 'sidebar-body';
  container.appendChild(body);

  const openAndMaybeCloseDrawer = (title) => {
    app.openCard(title);
    if (window.innerWidth <= 767) app.closeMobileDrawer();
  };

  if (activeTab === 'open') {
    const openCards = app.getOpenCards();
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.innerHTML = '<span class="muted">' + openCards.length + '</span>';
    if (openCards.length) {
      const closeAllBtn = document.createElement('button');
      closeAllBtn.type = 'button';
      closeAllBtn.className = 'btn btn-sm';
      closeAllBtn.textContent = t('closeAll', lang);
      closeAllBtn.addEventListener('click', () => app.closeAllCards());
      row.appendChild(closeAllBtn);
    }
    body.appendChild(row);

    const ul = document.createElement('ul');
    ul.className = 'side-list';
    for (const title of openCards) {
      const li = document.createElement('li');
      li.className = 'side-list-item';
      const linkBtn = document.createElement('button');
      linkBtn.type = 'button';
      linkBtn.className = 'side-link';
      linkBtn.textContent = title;
      linkBtn.addEventListener('click', () => openAndMaybeCloseDrawer(title));
      const xBtn = document.createElement('button');
      xBtn.type = 'button';
      xBtn.className = 'icon-btn';
      xBtn.setAttribute('aria-label', t('close', lang) + ' ' + title);
      xBtn.innerHTML = icon('close', 14);
      xBtn.addEventListener('click', () => app.closeCard(title));
      li.appendChild(linkBtn);
      li.appendChild(xBtn);
      ul.appendChild(li);
    }
    body.appendChild(ul);
  } else if (activeTab === 'recent') {
    const recent = runFilter('[all[tiddlers]!sort[modified]limit[40]]', app.store).titles;
    const ul = document.createElement('ul');
    ul.className = 'side-list';
    for (const title of recent) {
      const li = document.createElement('li');
      li.className = 'side-list-item';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'side-link';
      b.textContent = title;
      b.addEventListener('click', () => openAndMaybeCloseDrawer(title));
      li.appendChild(b);
      ul.appendChild(li);
    }
    body.appendChild(ul);
  } else if (activeTab === 'tags') {
    const tags = app.store.getAllTags({ includeSystem: false });
    const wrap = document.createElement('div');
    wrap.className = 'tag-row';
    for (const item of tags) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tag-pill';
      b.textContent = item.tag + ' (' + item.count + ')';
      b.addEventListener('click', () => app.setFilterSearch('[tag[' + item.tag + ']sort[title]]'));
      wrap.appendChild(b);
    }
    body.appendChild(wrap);
  } else if (activeTab === 'filter') {
    renderFilterTab(body, app, lang, openAndMaybeCloseDrawer);
  } else if (activeTab === 'system') {
    const sysTitles = runFilter('[all[system]sort[title]]', app.store).titles;
    const ul = document.createElement('ul');
    ul.className = 'side-list';
    for (const title of sysTitles) {
      const li = document.createElement('li');
      li.className = 'side-list-item';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'side-link';
      b.style.fontFamily = 'var(--font-mono)';
      b.style.fontSize = '0.78rem';
      b.textContent = title + (app.store.isOverriddenShadow(title) ? ' *' : '');
      b.addEventListener('click', () => openAndMaybeCloseDrawer(title));
      li.appendChild(b);
      ul.appendChild(li);
    }
    body.appendChild(ul);
  } else if (activeTab === 'settings') {
    renderSettingsTab(body, app, lang);
  } else if (activeTab.startsWith('user:')) {
    const cardTitle = activeTab.slice(5);
    const card = app.store.get(cardTitle);
    const customWrap = document.createElement('div');
    customWrap.className = 'card-body';
    customWrap.style.marginTop = '0';
    customWrap.innerHTML = card
      ? renderWikiText(card.text, app.store, { currentTiddler: cardTitle, lang })
      : '';
    wireWikiContentInteractions(customWrap, app, () => cardTitle);
    wireInteractiveWidgets(customWrap, app, { resetTimers: false });
    body.appendChild(customWrap);
  }
}

function renderFilterTab(body, app, lang, openFn) {
  const expr = app.getFilterExpr();
  body.innerHTML =
    '<div style="display:flex;gap:6px;">' +
      '<input class="input" data-flt-input type="text" placeholder="' + escapeHtml(t('filterPlaceholder', lang)) + '" value="' + escapeHtml(expr) + '" style="font-family:var(--font-mono);font-size:0.82rem;">' +
      '<button type="button" class="btn btn-primary btn-sm" data-flt-run>' + escapeHtml(t('filterRun', lang)) + '</button>' +
    '</div>' +
    '<div class="tag-row" data-flt-presets></div>' +
    '<div class="muted" data-flt-status></div>' +
    '<ul class="side-list" data-flt-results></ul>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
      '<button type="button" class="btn btn-sm" data-flt-save>' + escapeHtml(t('filterSaveAsCard', lang)) + '</button>' +
      '<button type="button" class="btn btn-sm" data-flt-json>' + escapeHtml(t('filterExportJson', lang)) + '</button>' +
    '</div>';

  const input = body.querySelector('[data-flt-input]');
  const statusEl = body.querySelector('[data-flt-status]');
  const resEl = body.querySelector('[data-flt-results]');
  const presetsEl = body.querySelector('[data-flt-presets]');

  const presets = [
    '[all[tiddlers]sort[title]]',
    '[tag[Proje]!field:durum[tamamlandi]]',
    '[orphans[]]',
    '[missing[]]'
  ];
  for (const p of presets) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tag-pill is-system';
    btn.textContent = p;
    btn.addEventListener('click', () => {
      input.value = p;
      app.setFilterSearch(p);
    });
    presetsEl.appendChild(btn);
  }

  const exec = () => {
    const curExpr = input.value;
    app.setFilterExprQuiet(curExpr);
    const res = runFilter(curExpr, app.store, { currentTiddler: app.getActiveCard() });
    resEl.innerHTML = '';
    if (res.error) {
      statusEl.className = 'error-msg';
      statusEl.textContent = res.error;
      return;
    }
    statusEl.className = 'muted';
    statusEl.textContent = t('filterCount', lang, { count: res.titles.length });
    for (const title of res.titles) {
      const li = document.createElement('li');
      li.className = 'side-list-item';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'side-link';
      b.textContent = title;
      b.addEventListener('click', () => openFn(title));
      li.appendChild(b);
      resEl.appendChild(li);
    }
  };

  body.querySelector('[data-flt-run]').addEventListener('click', exec);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') exec();
  });

  body.querySelector('[data-flt-save]').addEventListener('click', () => {
    const q = input.value.trim();
    if (!q) return;
    const title = 'Liste: ' + q.slice(0, 32);
    app.store.put({
      title,
      text: 'Filtre: `' + q + '`\n\n<<list filter="' + q.replace(/"/g, "'") + '">>',
      tags: ['Filtre']
    });
    openFn(title);
  });

  body.querySelector('[data-flt-json]').addEventListener('click', () => {
    const res = runFilter(input.value, app.store, { currentTiddler: app.getActiveCard() });
    if (res.error) return;
    const cards = res.titles.map((title) => app.store.get(title)).filter(Boolean);
    downloadTextFile(exportJson(cards), 'tidly-filter-export.json', 'application/json;charset=utf-8');
  });

  exec();
}

function renderSettingsTab(body, app, lang) {
  const palette = app.store.getText('$:/Palette', 'paper').trim();
  const font = app.store.getText('$:/Font', 'editorial').trim();
  const fontSize = parseInt(app.store.getText('$:/FontSize', '16'), 10) || 16;
  const layout = app.store.getText('$:/Layout', 'river').trim();
  const siteTitle = app.store.getText('$:/SiteTitle', 'Tidly Notebook');
  const siteSub = app.store.getText('$:/SiteSubtitle', '');
  const defFilter = app.store.getText('$:/DefaultTiddlers', '');

  let custom = {};
  try {
    custom = JSON.parse(app.store.getText('$:/CustomColors', '{}')) || {};
  } catch {
    custom = {};
  }
  const cs = typeof getComputedStyle !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const curColor = (key, fallback) => custom[key] || (cs ? cs.getPropertyValue('--' + key).trim() : fallback) || fallback;

  body.innerHTML =
    '<div class="settings-group">' +
      '<div class="settings-label">' + escapeHtml(t('siteTitleLabel', lang)) + '</div>' +
      '<input class="input" data-set-title type="text" value="' + escapeHtml(siteTitle) + '">' +
      '<div class="settings-label">' + escapeHtml(t('siteSubtitleLabel', lang)) + '</div>' +
      '<input class="input" data-set-sub type="text" value="' + escapeHtml(siteSub) + '">' +
      '<div class="settings-label">' + escapeHtml(t('defaultTiddlersLabel', lang)) + '</div>' +
      '<input class="input" data-set-def type="text" value="' + escapeHtml(defFilter) + '" style="font-family:var(--font-mono);font-size:0.8rem;">' +
    '</div>' +
    '<div class="settings-group">' +
      '<div class="settings-label">' + escapeHtml(t('modesTitle', lang)) + '</div>' +
      '<button type="button" class="btn btn-sm" data-set-modes>' + icon('layers', 15) + ' <span>' + escapeHtml(t('modesTitle', lang)) + '</span></button>' +
    '</div>' +
    '<div class="settings-group">' +
      '<div class="settings-label">' + escapeHtml(t('paletteLabel', lang)) + '</div>' +
      '<div class="palette-grid">' +
        ['paper', 'night', 'sepia', 'forest', 'classroom', 'clinic'].map((p) => {
          const key = 'palette' + p[0].toUpperCase() + p.slice(1);
          return '<button type="button" class="btn btn-sm' + (palette === p ? ' btn-primary' : '') + '" data-set-pal="' + p + '">' + escapeHtml(t(key, lang)) + '</button>';
        }).join('') +
      '</div>' +
      '<div class="settings-label" style="margin-top:6px;">' + escapeHtml(t('customColorsLabel', lang)) + '</div>' +
      '<div class="color-pickers">' +
        '<label class="color-item"><span>' + escapeHtml(t('colorBg', lang)) + '</span><input type="color" data-col="bg" value="' + escapeHtml(curColor('bg', '#F3EFE6')) + '"></label>' +
        '<label class="color-item"><span>' + escapeHtml(t('colorSurface', lang)) + '</span><input type="color" data-col="surface" value="' + escapeHtml(curColor('surface', '#FAF8F3')) + '"></label>' +
        '<label class="color-item"><span>' + escapeHtml(t('colorInk', lang)) + '</span><input type="color" data-col="ink" value="' + escapeHtml(curColor('ink', '#1F1C18')) + '"></label>' +
        '<label class="color-item"><span>' + escapeHtml(t('colorAccent', lang)) + '</span><input type="color" data-col="accent" value="' + escapeHtml(curColor('accent', '#B8432E')) + '"></label>' +
      '</div>' +
      '<button type="button" class="btn btn-sm" data-reset-cols>' + escapeHtml(t('resetColors', lang)) + '</button>' +
    '</div>' +
    '<div class="settings-group">' +
      '<div class="settings-label">' + escapeHtml(t('fontLabel', lang)) + '</div>' +
      '<select class="select" data-set-font>' +
        '<option value="editorial"' + (font === 'editorial' ? ' selected' : '') + '>' + escapeHtml(t('fontEditorial', lang)) + '</option>' +
        '<option value="sans"' + (font === 'sans' ? ' selected' : '') + '>' + escapeHtml(t('fontSans', lang)) + '</option>' +
        '<option value="mono"' + (font === 'mono' ? ' selected' : '') + '>' + escapeHtml(t('fontMono', lang)) + '</option>' +
      '</select>' +
      '<div class="settings-label" style="margin-top:4px;">' + escapeHtml(t('fontSizeLabel', lang)) + ' (<span data-fs-val>' + fontSize + '</span>px)</div>' +
      '<input type="range" min="13" max="22" value="' + fontSize + '" data-set-fs>' +
      '<div class="settings-label" style="margin-top:4px;">' + escapeHtml(t('layoutLabel', lang)) + '</div>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;">' +
        '<button type="button" class="btn btn-sm' + (layout === 'river' ? ' btn-primary' : '') + '" data-set-layout="river">' + escapeHtml(t('layoutRiver', lang)) + '</button>' +
        '<button type="button" class="btn btn-sm' + (layout === 'focus' ? ' btn-primary' : '') + '" data-set-layout="focus">' + escapeHtml(t('layoutFocus', lang)) + '</button>' +
        '<button type="button" class="btn btn-sm' + (layout === 'split' ? ' btn-primary' : '') + '" data-set-layout="split">' + escapeHtml(t('layoutSplit', lang)) + '</button>' +
      '</div>' +
      '<div class="settings-label" style="margin-top:4px;">' + escapeHtml(t('languageLabel', lang)) + '</div>' +
      '<div style="display:flex;gap:6px;">' +
        '<button type="button" class="btn btn-sm' + (lang === 'tr' ? ' btn-primary' : '') + '" data-set-lang="tr">Türkçe</button>' +
        '<button type="button" class="btn btn-sm' + (lang === 'en' ? ' btn-primary' : '') + '" data-set-lang="en">English</button>' +
      '</div>' +
    '</div>' +
    '<div class="settings-group">' +
      '<div class="settings-label">' + escapeHtml(t('encryptionLabel', lang)) + '</div>' +
      '<div class="muted">' + escapeHtml(app.isEncrypted() ? t('encryptionActive', lang) : t('encryptionInactive', lang)) + '</div>' +
      '<button type="button" class="btn btn-sm" data-open-enc>' + icon(app.isEncrypted() ? 'lock' : 'unlock', 15) + ' <span>' + escapeHtml(t('encryptionSet', lang)) + '</span></button>' +
    '</div>' +
    '<div class="settings-group">' +
      '<div class="settings-label">' + escapeHtml(t('importExportLabel', lang)) + '</div>' +
      '<div class="drop-zone" data-drop-zone>' +
        '<span>' + escapeHtml(t('importDropHint', lang)) + '</span>' +
        '<input type="file" multiple accept=".html,.htm,.json,.tid,.md,.csv" data-file-input style="display:none;">' +
        '<button type="button" class="btn btn-sm" data-choose-file>' + icon('upload', 15) + ' <span>' + escapeHtml(t('importChooseFile', lang)) + '</span></button>' +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">' +
        '<button type="button" class="btn btn-sm" data-exp-html>' + icon('download', 15) + ' <span>' + escapeHtml(t('exportHtml', lang)) + '</span></button>' +
        '<button type="button" class="btn btn-sm" data-exp-all-json>' + icon('download', 15) + ' <span>' + escapeHtml(t('exportJson', lang)) + '</span></button>' +
      '</div>' +
    '</div>';

  const putSys = (title, val) => {
    app.store.put({ title, text: val, type: 'text/plain' });
    app.render();
  };

  body.querySelector('[data-set-title]').addEventListener('change', (e) => putSys('$:/SiteTitle', e.target.value.trim() || 'Tidly Notebook'));
  body.querySelector('[data-set-sub]').addEventListener('change', (e) => putSys('$:/SiteSubtitle', e.target.value));
  body.querySelector('[data-set-def]').addEventListener('change', (e) => putSys('$:/DefaultTiddlers', e.target.value));

  body.querySelector('[data-set-modes]').addEventListener('click', () => app.openModes());
  body.querySelectorAll('[data-set-pal]').forEach((b) => {
    b.addEventListener('click', () => putSys('$:/Palette', b.getAttribute('data-set-pal')));
  });
  body.querySelectorAll('[data-col]').forEach((inp) => {
    inp.addEventListener('change', () => {
      custom[inp.getAttribute('data-col')] = inp.value;
      app.store.put({ title: '$:/CustomColors', text: JSON.stringify(custom), type: 'application/json' });
      app.render();
    });
  });
  body.querySelector('[data-reset-cols]').addEventListener('click', () => {
    app.store.delete('$:/CustomColors');
    app.render();
  });

  body.querySelector('[data-set-font]').addEventListener('change', (e) => putSys('$:/Font', e.target.value));
  const fsSlider = body.querySelector('[data-set-fs]');
  fsSlider.addEventListener('input', () => {
    body.querySelector('[data-fs-val]').textContent = fsSlider.value;
    document.documentElement.style.setProperty('--font-size-base', fsSlider.value + 'px');
  });
  fsSlider.addEventListener('change', () => putSys('$:/FontSize', fsSlider.value));

  body.querySelectorAll('[data-set-layout]').forEach((b) => {
    b.addEventListener('click', () => putSys('$:/Layout', b.getAttribute('data-set-layout')));
  });
  body.querySelectorAll('[data-set-lang]').forEach((b) => {
    b.addEventListener('click', () => putSys('$:/Language', b.getAttribute('data-set-lang')));
  });

  body.querySelector('[data-open-enc]').addEventListener('click', () => openEncryptionModal(app));
  body.querySelector('[data-exp-html]').addEventListener('click', () => app.saveHtml());
  body.querySelector('[data-exp-all-json]').addEventListener('click', () => app.exportJsonAll());

  const fileInput = body.querySelector('[data-file-input]');
  const dropZone = body.querySelector('[data-drop-zone]');
  body.querySelector('[data-choose-file]').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length) {
      app.handleImportFiles(fileInput.files);
      fileInput.value = '';
    }
  });
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('is-dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('is-dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('is-dragover');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      app.handleImportFiles(e.dataTransfer.files);
    } else {
      showToast(t('noTemplates', lang));
    }
  });
}
