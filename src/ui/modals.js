import { escapeHtml } from '../core/utils.js';
import { t } from '../core/i18n.js';
import { isCryptoAvailable } from '../core/crypto.js';
import { runFilter } from '../core/filter.js';
import { WORKSPACE_PACKS } from '../packs/index.js';
import { icon } from './icons.js';

function getToastStack() {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
  }
  return stack;
}

export function showToast(msg, { actionLabel = '', onAction = null, duration = 4200 } = {}) {
  if (typeof document === 'undefined') return;
  const stack = getToastStack();
  const el = document.createElement('div');
  el.className = 'toast';
  const span = document.createElement('span');
  span.textContent = msg;
  el.appendChild(span);

  if (actionLabel && typeof onAction === 'function') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action';
    btn.textContent = actionLabel;
    btn.addEventListener('click', () => {
      onAction();
      el.remove();
    });
    el.appendChild(btn);
  }

  stack.appendChild(el);
  setTimeout(() => {
    if (el.parentNode) el.remove();
  }, duration);
}

export function createModal({ title, wide = false, onClose = null }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');

  const card = document.createElement('div');
  card.className = 'modal-card' + (wide ? ' is-wide' : '');

  const head = document.createElement('div');
  head.className = 'modal-head';
  const h2 = document.createElement('h2');
  h2.textContent = title;
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'icon-btn';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = icon('close', 18);

  head.appendChild(h2);
  head.appendChild(closeBtn);
  card.appendChild(head);
  backdrop.appendChild(card);

  const close = () => {
    document.removeEventListener('keydown', onKey);
    if (backdrop.parentNode) backdrop.remove();
    if (typeof onClose === 'function') onClose();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(backdrop);

  return { backdrop, card, close };
}

export function openCommandPalette(app) {
  const lang = app.lang();
  const { card, close } = createModal({ title: t('search', lang) });

  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'input';
  input.placeholder = t('paletteSearchPlaceholder', lang);
  input.setAttribute('aria-label', t('paletteSearchPlaceholder', lang));

  const listEl = document.createElement('div');
  listEl.className = 'palette-results';
  card.appendChild(input);
  card.appendChild(listEl);

  const commands = [
    { label: t('cmdNewCard', lang), kind: 'cmd', run: () => app.createNewCard() },
    { label: t('cmdModes', lang), kind: 'cmd', run: () => openModesModal(app) },
    { label: t('cmdSave', lang), kind: 'cmd', run: () => app.saveHtml() },
    { label: t('cmdGraph', lang), kind: 'cmd', run: () => app.openGraph() },
    { label: t('cmdToggleTheme', lang), kind: 'cmd', run: () => app.toggleDayNight() },
    { label: t('cmdCycleLayout', lang), kind: 'cmd', run: () => app.cycleLayout() },
    { label: t('cmdExportJson', lang), kind: 'cmd', run: () => app.exportJsonAll() },
    { label: t('cmdEncryption', lang), kind: 'cmd', run: () => openEncryptionModal(app) }
  ];

  let items = [];
  let selectedIdx = 0;

  const rebuild = () => {
    const q = input.value.trim();
    const nextItems = [];

    if (!q) {
      const recent = runFilter('[all[tiddlers]!sort[modified]limit[8]]', app.store).titles;
      for (const title of recent) {
        nextItems.push({ label: title, meta: t('tabRecent', lang), run: () => app.openCard(title) });
      }
      for (const cmd of commands) {
        nextItems.push({ label: cmd.label, meta: '>', run: cmd.run });
      }
    } else {
      const safeQ = q.replace(/\]/g, '');
      const cardMatches = runFilter('[all[tiddlers]search[' + safeQ + ']sort[title]limit[12]]', app.store).titles;
      for (const title of cardMatches) {
        const item = app.store.get(title);
        nextItems.push({
          label: title,
          meta: item && item.tags.length ? item.tags.join(', ') : '',
          run: () => app.openCard(title)
        });
      }
      const sysMatches = runFilter('[all[system]search[' + safeQ + ']sort[title]limit[5]]', app.store).titles;
      for (const title of sysMatches) {
        nextItems.push({ label: title, meta: t('tabSystem', lang), run: () => app.openCard(title) });
      }
      for (const cmd of commands) {
        if (cmd.label.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))) {
          nextItems.push({ label: cmd.label, meta: '>', run: cmd.run });
        }
      }
      if (!app.store.has(q)) {
        nextItems.push({
          label: '+ ' + t('newCard', lang) + ': "' + q + '"',
          meta: t('newCard', lang),
          run: () => app.createNewCard({ title: q })
        });
      }
    }

    items = nextItems;
    selectedIdx = 0;
    renderList();
  };

  const renderList = () => {
    listEl.innerHTML = '';
    items.forEach((it, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'palette-item' + (idx === selectedIdx ? ' is-selected' : '');
      btn.innerHTML = '<span>' + escapeHtml(it.label) + '</span><span class="muted">' + escapeHtml(it.meta) + '</span>';
      btn.addEventListener('click', () => {
        close();
        it.run();
      });
      listEl.appendChild(btn);
    });
  };

  input.addEventListener('input', rebuild);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length) {
        selectedIdx = (selectedIdx + 1) % items.length;
        renderList();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length) {
        selectedIdx = (selectedIdx - 1 + items.length) % items.length;
        renderList();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIdx]) {
        const chosen = items[selectedIdx];
        close();
        chosen.run();
      }
    }
  });

  rebuild();
  setTimeout(() => input.focus(), 10);
}

export function openRenameModal(app, oldTitle) {
  const lang = app.lang();
  const { card, close } = createModal({ title: t('renameTitle', lang) });

  const form = document.createElement('form');
  form.className = 'editor-wrap';
  form.innerHTML =
    '<label class="settings-label" for="rename-input">' + escapeHtml(t('titleLabel', lang)) + '</label>' +
    '<input id="rename-input" class="input" type="text" value="' + escapeHtml(oldTitle) + '" required>' +
    '<label style="display:flex;align-items:center;gap:8px;font-size:0.88rem;cursor:pointer;">' +
      '<input id="rename-links-chk" type="checkbox" checked>' +
      '<span>' + escapeHtml(t('renameUpdateLinks', lang)) + '</span>' +
    '</label>' +
    '<div id="rename-err" class="error-msg"></div>' +
    '<div class="editor-footer">' +
      '<button type="button" class="btn" id="rename-cancel">' + escapeHtml(t('cancel', lang)) + '</button>' +
      '<button type="submit" class="btn btn-primary">' + escapeHtml(t('save', lang)) + '</button>' +
    '</div>';

  card.appendChild(form);
  const inputEl = form.querySelector('#rename-input');
  const chkEl = form.querySelector('#rename-links-chk');
  const errEl = form.querySelector('#rename-err');
  form.querySelector('#rename-cancel').addEventListener('click', close);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nextTitle = inputEl.value.trim();
    if (!nextTitle) {
      errEl.textContent = t('renameErrorEmpty', lang);
      return;
    }
    if (nextTitle !== oldTitle && app.store.has(nextTitle)) {
      errEl.textContent = t('renameErrorExists', lang, { title: nextTitle });
      return;
    }
    app.renameCard(oldTitle, nextTitle, chkEl.checked);
    close();
  });

  setTimeout(() => {
    inputEl.focus();
    inputEl.select();
  }, 10);
}

export function openEncryptionModal(app) {
  const lang = app.lang();
  const { card, close } = createModal({ title: t('encryptionLabel', lang) });

  if (!isCryptoAvailable()) {
    const p = document.createElement('p');
    p.className = 'error-msg';
    p.textContent = t('encryptionUnsupported', lang);
    card.appendChild(p);
    return;
  }

  const encrypted = app.isEncrypted();
  const form = document.createElement('form');
  form.className = 'editor-wrap';
  form.innerHTML =
    '<p class="muted">' + escapeHtml(encrypted ? t('encryptionActive', lang) : t('encryptionInactive', lang)) + '</p>' +
    '<label class="settings-label" for="enc-pw1">' + escapeHtml(t('passwordLabel', lang)) + '</label>' +
    '<input id="enc-pw1" class="input" type="password" autocomplete="new-password">' +
    '<label class="settings-label" for="enc-pw2">' + escapeHtml(t('passwordConfirmLabel', lang)) + '</label>' +
    '<input id="enc-pw2" class="input" type="password" autocomplete="new-password">' +
    '<div id="enc-err" class="error-msg"></div>' +
    '<div class="editor-footer">' +
      (encrypted ? '<button type="button" class="btn btn-danger" id="enc-disable">' + escapeHtml(t('encryptionDisable', lang)) + '</button>' : '') +
      '<button type="button" class="btn" id="enc-cancel">' + escapeHtml(t('cancel', lang)) + '</button>' +
      '<button type="submit" class="btn btn-primary">' + escapeHtml(t('encryptionSet', lang)) + '</button>' +
    '</div>';

  card.appendChild(form);
  const pw1 = form.querySelector('#enc-pw1');
  const pw2 = form.querySelector('#enc-pw2');
  const errEl = form.querySelector('#enc-err');

  form.querySelector('#enc-cancel').addEventListener('click', close);
  const disableBtn = form.querySelector('#enc-disable');
  if (disableBtn) {
    disableBtn.addEventListener('click', async () => {
      await app.disableEncryption();
      close();
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pw1.value) {
      errEl.textContent = t('passwordEmpty', lang);
      return;
    }
    if (pw1.value !== pw2.value) {
      errEl.textContent = t('passwordMismatch', lang);
      return;
    }
    await app.setPassword(pw1.value);
    close();
  });

  setTimeout(() => pw1.focus(), 10);
}

export function openImportModal(app, importedTiddlers, sourceLabel = '') {
  const lang = app.lang();
  const { card, close } = createModal({ title: t('importTitle', lang) + (sourceLabel ? ' (' + sourceLabel + ')' : '') });

  const listHtml = importedTiddlers.slice(0, 20).map((item) => {
    const exists = app.store.has(item.title);
    return '<li class="side-list-item"><span>' + escapeHtml(item.title) + '</span>' +
      (exists ? '<span class="muted">!</span>' : '') + '</li>';
  }).join('');

  const extra = importedTiddlers.length > 20 ? '<p class="muted">+' + (importedTiddlers.length - 20) + ' ...</p>' : '';

  const wrap = document.createElement('div');
  wrap.className = 'editor-wrap';
  wrap.innerHTML =
    '<ul class="side-list" style="max-height:180px;overflow-y:auto;border:1px solid var(--border);padding:8px;border-radius:var(--r-ctrl);">' +
      listHtml +
    '</ul>' +
    extra +
    '<div class="settings-label">' + escapeHtml(t('conflictModeLabel', lang)) + '</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:12px;font-size:0.88rem;">' +
      '<label><input type="radio" name="imp-conflict" value="overwrite" checked> ' + escapeHtml(t('conflictOverwrite', lang)) + '</label>' +
      '<label><input type="radio" name="imp-conflict" value="rename"> ' + escapeHtml(t('conflictRename', lang)) + '</label>' +
      '<label><input type="radio" name="imp-conflict" value="skip"> ' + escapeHtml(t('conflictSkip', lang)) + '</label>' +
    '</div>' +
    '<div class="editor-footer">' +
      '<button type="button" class="btn" id="imp-cancel">' + escapeHtml(t('cancel', lang)) + '</button>' +
      '<button type="button" class="btn btn-primary" id="imp-go">' + escapeHtml(t('importConfirm', lang, { count: importedTiddlers.length })) + '</button>' +
    '</div>';

  card.appendChild(wrap);
  wrap.querySelector('#imp-cancel').addEventListener('click', close);
  wrap.querySelector('#imp-go').addEventListener('click', () => {
    const modeEl = wrap.querySelector('input[name="imp-conflict"]:checked');
    const mode = modeEl ? modeEl.value : 'overwrite';
    app.applyImport(importedTiddlers, mode);
    close();
  });
}

export function renderUnlockScreen(root, envelope, onUnlock) {
  const meta = (envelope && envelope.meta) || {};
  const lang = meta.lang === 'en' ? 'en' : 'tr';
  const palette = meta.palette || 'paper';

  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-palette', palette);
    document.documentElement.setAttribute('lang', lang);
  }

  root.innerHTML =
    '<div class="unlock-shell">' +
      '<form class="unlock-card" id="unlock-form">' +
        '<div style="display:flex;align-items:center;gap:10px;color:var(--accent);">' +
          icon('lock', 24) +
          '<h1 style="margin:0;font-family:var(--font-display);font-size:1.4rem;color:var(--ink);">' +
            escapeHtml(t('unlockTitle', lang)) +
          '</h1>' +
        '</div>' +
        '<p class="muted" style="margin:0;">' + escapeHtml(t('unlockSubtitle', lang)) + '</p>' +
        '<input id="unlock-pw" class="input" type="password" autocomplete="current-password" placeholder="' + escapeHtml(t('passwordLabel', lang)) + '" required>' +
        '<div id="unlock-err" class="error-msg"></div>' +
        '<button type="submit" class="btn btn-primary" id="unlock-submit">' + escapeHtml(t('unlockButton', lang)) + '</button>' +
      '</form>' +
    '</div>';

  const form = root.querySelector('#unlock-form');
  const pwInput = root.querySelector('#unlock-pw');
  const errEl = root.querySelector('#unlock-err');
  const submitBtn = root.querySelector('#unlock-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';
    submitBtn.disabled = true;
    try {
      await onUnlock(pwInput.value);
    } catch {
      errEl.textContent = t('unlockWrong', lang);
      submitBtn.disabled = false;
      pwInput.focus();
      pwInput.select();
    }
  });

  setTimeout(() => pwInput.focus(), 10);
}

export function openModesModal(app) {
  const lang = app.lang();
  const isEn = lang === 'en';
  const activeMode = app.store.getText('$:/ActiveMode', 'general').trim();
  const { card, close } = createModal({ title: t('modesTitle', lang), wide: true });

  const sub = document.createElement('p');
  sub.className = 'muted';
  sub.style.margin = '0';
  sub.textContent = t('modesSubtitle', lang);
  card.appendChild(sub);

  const grid = document.createElement('div');
  grid.className = 'mode-card-grid';

  for (const pack of WORKSPACE_PACKS) {
    const isCur = pack.id === activeMode;
    const itemEl = document.createElement('div');
    itemEl.className = 'mode-card' + (isCur ? ' is-current' : '');
    const title = isEn ? pack.nameEn : pack.nameTr;
    const desc = isEn ? pack.descEn : pack.descTr;
    const badge = isCur ? t('modeCurrentBadge', lang) : pack.badgeTr;

    itemEl.innerHTML =
      '<div class="mode-card-head">' +
        '<h3 class="mode-card-title">' + escapeHtml(title) + '</h3>' +
        '<span class="tag-pill' + (isCur ? ' is-system' : '') + '">' + escapeHtml(badge) + '</span>' +
      '</div>' +
      '<p class="muted" style="margin:0;">' + escapeHtml(desc) + '</p>' +
      '<div class="mode-card-actions">' +
        '<button type="button" class="btn btn-primary btn-sm" data-m-merge>' + escapeHtml(t('modeMergeBtn', lang)) + '</button>' +
        '<button type="button" class="btn btn-sm" data-m-clean>' + escapeHtml(t('modeCleanBtn', lang)) + '</button>' +
        '<button type="button" class="btn btn-sm" data-m-dl>' + icon('download', 14) + ' <span>' + escapeHtml(t('modeDownloadBtn', lang)) + '</span></button>' +
      '</div>';

    itemEl.querySelector('[data-m-merge]').addEventListener('click', () => {
      close();
      app.applyPack(pack.id, 'merge');
    });
    itemEl.querySelector('[data-m-clean]').addEventListener('click', () => {
      if (!window.confirm(t('modeCleanConfirm', lang, { mode: title }))) return;
      close();
      app.applyPack(pack.id, 'clean');
    });
    itemEl.querySelector('[data-m-dl]').addEventListener('click', () => {
      app.downloadEditionHtml(pack.id);
    });
    grid.appendChild(itemEl);
  }

  card.appendChild(grid);
}
