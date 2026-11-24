import { escapeHtml, formatDate } from '../core/utils.js';
import { t } from '../core/i18n.js';
import { formatBytes } from '../core/attachments.js';
import { renderWikiText, toggleTaskCheckbox, expandTemplatePlaceholders } from '../core/parser.js';
import { exportMarkdown, exportTid, exportJson } from '../core/formats.js';
import { downloadTextFile } from '../storage/persistence.js';
import { icon } from './icons.js';
import { wireInteractiveWidgets } from './widgets.js';
import { renderEditor } from './editor.js';
import { showToast, openRenameModal } from './modals.js';

function dataUrlToBlob(dataUrl) {
  const parts = String(dataUrl || '').split(',');
  const header = parts[0] || '';
  const b64 = parts[1] || '';
  const mimeMatch = /data:([^;]+)/i.exec(header);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function wireWikiContentInteractions(container, app, getSourceTiddler) {
  container.addEventListener('click', (e) => {
    const link = e.target.closest('.wiki-link');
    if (link) {
      e.preventDefault();
      const target = link.getAttribute('data-tiddler');
      if (target) app.openCard(target);
      return;
    }

    const copyBtn = e.target.closest('[data-copy-code]');
    if (copyBtn) {
      const pre = copyBtn.closest('.code-block') && copyBtn.closest('.code-block').querySelector('pre');
      if (pre && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(pre.textContent || '').then(() => {
          showToast(t('copiedToast', app.lang()));
        }).catch(() => {});
      }
      return;
    }

    const macroBtn = e.target.closest('.action-macro-btn');
    if (macroBtn) {
      const action = macroBtn.getAttribute('data-action');
      if (action === 'new-card') {
        const tpl = macroBtn.getAttribute('data-template') || '';
        const tagsStr = macroBtn.getAttribute('data-tags') || '';
        const customTitle = macroBtn.getAttribute('data-title') || '';
        const tags = tagsStr.split(',').map((s) => s.trim()).filter(Boolean);
        app.createNewCard({ title: customTitle, templateTitle: tpl, tags });
      } else if (action === 'set-field') {
        const target = macroBtn.getAttribute('data-tiddler') || (getSourceTiddler ? getSourceTiddler(macroBtn) : '');
        const field = macroBtn.getAttribute('data-field');
        const value = macroBtn.getAttribute('data-value') || '';
        if (target && field) {
          app.store.setField(target, field, value);
          app.render();
        }
      }
    }
  });

  container.addEventListener('change', (e) => {
    const chk = e.target.closest('.task-item input[type="checkbox"]');
    if (!chk) return;
    const lineIdx = Number(chk.getAttribute('data-task-line'));
    const sourceTitle = chk.getAttribute('data-task-tiddler') || (getSourceTiddler ? getSourceTiddler(chk) : '');
    if (!sourceTitle || Number.isNaN(lineIdx)) return;
    const item = app.store.get(sourceTitle);
    if (!item) return;
    const nextText = toggleTaskCheckbox(item.text, lineIdx);
    if (nextText !== item.text) {
      app.store.put({ ...item, text: nextText });
      app.render();
    }
  });
}

function renderCardBodyContent(tiddler, title, app, lang) {
  if (!tiddler) {
    return (
      '<p class="muted">' + escapeHtml(t('missingCardHint', lang, { title })) + '</p>' +
      '<button type="button" class="btn btn-primary btn-sm" data-create-missing="' + escapeHtml(title) + '">' +
        icon('edit', 15) + ' <span>' + escapeHtml(t('edit', lang)) + '</span>' +
      '</button>'
    );
  }
  if (tiddler.type === 'text/css' || tiddler.type === 'text/plain' || tiddler.type === 'application/json') {
    return (
      '<div class="code-block">' +
        '<div class="code-head"><span>' + escapeHtml(tiddler.type) + '</span>' +
        '<button type="button" class="copy-code-btn" data-copy-code="1">' + escapeHtml(lang === 'en' ? 'Copy' : 'Kopyala') + '</button></div>' +
        '<pre><code>' + escapeHtml(tiddler.text) + '</code></pre>' +
      '</div>'
    );
  }
  return renderWikiText(tiddler.text, app.store, { currentTiddler: title, lang });
}

export function renderRiver(container, app) {
  const lang = app.lang();
  const layout = app.store.getText('$:/Layout', 'river').trim();
  const openCards = app.getOpenCards();
  const activeCard = app.getActiveCard();

  container.innerHTML = '';

  if (layout === 'focus' && openCards.length > 0) {
    const strip = document.createElement('div');
    strip.className = 'focus-tabs';
    for (const title of openCards) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm' + (title === activeCard ? ' btn-primary' : '');
      btn.textContent = title;
      btn.addEventListener('click', () => app.openCard(title));
      strip.appendChild(btn);
    }
    container.appendChild(strip);
  }

  const river = document.createElement('div');
  river.className = 'story-river';
  container.appendChild(river);

  if (!openCards.length) {
    river.innerHTML =
      '<div class="empty-state">' +
        '<h2 style="margin:0;font-family:var(--font-display);">' + escapeHtml(t('emptyRiverTitle', lang)) + '</h2>' +
        '<p class="muted" style="margin:0;max-width:400px;">' + escapeHtml(t('emptyRiverBody', lang)) + '</p>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:6px;">' +
          '<button type="button" class="btn btn-primary" data-empty-new>' + icon('plus', 16) + ' <span>' + escapeHtml(t('newCard', lang)) + '</span></button>' +
          '<button type="button" class="btn" data-empty-default>' + escapeHtml(t('openDefault', lang)) + '</button>' +
        '</div>' +
      '</div>';
    river.querySelector('[data-empty-new]').addEventListener('click', () => app.createNewCard());
    river.querySelector('[data-empty-default]').addEventListener('click', () => app.openDefaultCards());
    return;
  }

  const visibleTitles = layout === 'focus'
    ? [openCards.includes(activeCard) ? activeCard : openCards[0]]
    : openCards;

  for (const title of visibleTitles) {
    const tiddler = app.store.get(title);
    const editing = app.isEditing(title);
    const folded = app.isFolded(title);
    const infoOpen = app.isInfoOpen(title);
    const isShadow = app.store.isShadow(title);
    const isOverridden = app.store.isOverriddenShadow(title);

    const card = document.createElement('article');
    card.className = 'tiddler-card' + (title === activeCard ? ' is-active' : '');
    card.setAttribute('data-card-title', title);
    card.addEventListener('mousedown', () => app.setActiveCard(title));

    const header = document.createElement('header');
    header.className = 'card-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'card-title-wrap';
    const badgeHtml = isOverridden
      ? ' <span class="tag-pill is-system">' + escapeHtml(t('shadowModified', lang)) + '</span>'
      : (isShadow ? ' <span class="tag-pill is-system">' + escapeHtml(t('shadowDefault', lang)) + '</span>' : '');
    const metaText = tiddler
      ? formatDate(tiddler.modified, lang)
      : t('untitled', lang);

    titleWrap.innerHTML =
      '<h2 class="card-title">' + escapeHtml(title) + '</h2>' +
      '<div class="card-meta-line"><span>' + escapeHtml(metaText) + '</span>' + badgeHtml + '</div>';

    if (tiddler && tiddler.tags.length && !editing) {
      const tagRow = document.createElement('div');
      tagRow.className = 'tag-row';
      for (const tg of tiddler.tags) {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'tag-pill' + (tg.startsWith('$:/') ? ' is-system' : '');
        pill.textContent = tg;
        pill.addEventListener('click', () => app.setFilterSearch('[tag[' + tg + ']sort[title]]'));
        tagRow.appendChild(pill);
      }
      titleWrap.appendChild(tagRow);
    }

    const actions = document.createElement('div');
    actions.className = 'card-actions';
    if (!editing) {
      const addAction = (iconName, label, onClick) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'icon-btn';
        b.title = label;
        b.setAttribute('aria-label', label);
        b.innerHTML = icon(iconName, 17);
        b.addEventListener('click', onClick);
        actions.appendChild(b);
      };
      addAction('edit', t('edit', lang), () => app.startEdit(title));
      addAction('info', t('info', lang), () => app.toggleInfo(title));
      addAction(folded ? 'unfold' : 'fold', folded ? t('unfold', lang) : t('fold', lang), () => app.toggleFold(title));
      if (layout !== 'focus' && openCards.length > 1) {
        addAction('up', t('moveUp', lang), () => app.moveCard(title, -1));
        addAction('down', t('moveDown', lang), () => app.moveCard(title, 1));
      }
      addAction('close', t('close', lang), () => app.closeCard(title));
    }

    header.appendChild(titleWrap);
    header.appendChild(actions);
    card.appendChild(header);

    if (editing) {
      const editContainer = document.createElement('div');
      editContainer.style.marginTop = '14px';
      const draft = tiddler || {
        title,
        text: '',
        tags: [],
        type: 'text/vnd.tidly',
        fields: {}
      };
      renderEditor(editContainer, draft, app, 'write');
      card.appendChild(editContainer);
    } else if (!folded) {
      const body = document.createElement('div');
      body.className = 'card-body';
      body.innerHTML = renderCardBodyContent(tiddler, title, app, lang);
      const createBtn = body.querySelector('[data-create-missing]');
      if (createBtn) {
        createBtn.addEventListener('click', () => {
          app.store.put({ title, text: expandTemplatePlaceholders('# ${baslik}\n\n', { title }) });
          app.startEdit(title);
        });
      }
      card.appendChild(body);

      if (tiddler && Array.isArray(tiddler.attachments) && tiddler.attachments.length) {
        const tray = document.createElement('div');
        tray.className = 'attachments-tray';
        tray.innerHTML = '<div class="settings-label">' + escapeHtml(t('attachmentsLabel', lang)) + ' (' + tiddler.attachments.length + ')</div><div class="att-list"></div>';
        const listEl = tray.querySelector('.att-list');
        for (const att of tiddler.attachments) {
          const itemEl = document.createElement('div');
          itemEl.className = 'att-item';
          const ext = (att.name.split('.').pop() || 'FILE').toUpperCase();
          const canPreviewImg = /^image\/(png|jpeg|jpg|gif|webp)$/i.test(att.mime);
          const canAudio = /^audio\//i.test(att.mime);
          const canOpenTab = canPreviewImg || att.mime === 'application/pdf' || att.mime.startsWith('text/');

          itemEl.innerHTML =
            '<div class="att-meta">' +
              '<span class="att-badge">' + escapeHtml(ext) + '</span>' +
              '<span class="att-name">' + escapeHtml(att.name) + '</span>' +
              '<span class="muted">' + escapeHtml(formatBytes(att.size)) + '</span>' +
            '</div>' +
            '<div style="display:flex;gap:6px;">' +
              (canOpenTab ? '<button type="button" class="btn btn-sm" data-att-open>' + escapeHtml(t('attachmentOpen', lang)) + '</button>' : '') +
              '<button type="button" class="btn btn-sm" data-att-dl>' + icon('download', 14) + ' <span>' + escapeHtml(t('attachmentDownload', lang)) + '</span></button>' +
            '</div>';

          if (canPreviewImg) {
            const img = document.createElement('img');
            img.className = 'att-preview-img';
            img.src = att.dataUrl;
            img.alt = att.name;
            img.loading = 'lazy';
            img.style.width = '100%';
            itemEl.appendChild(img);
          } else if (canAudio) {
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.preload = 'none';
            audio.src = att.dataUrl;
            audio.style.width = '100%';
            itemEl.appendChild(audio);
          }

          const openBtn = itemEl.querySelector('[data-att-open]');
          if (openBtn) {
            openBtn.addEventListener('click', () => {
              const blob = dataUrlToBlob(att.dataUrl);
              const url = URL.createObjectURL(blob);
              window.open(url, '_blank', 'noopener,noreferrer');
              setTimeout(() => URL.revokeObjectURL(url), 60000);
            });
          }
          itemEl.querySelector('[data-att-dl]').addEventListener('click', () => {
            const blob = dataUrlToBlob(att.dataUrl);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = att.name;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              URL.revokeObjectURL(url);
              if (a.parentNode) a.remove();
            }, 1500);
          });
          listEl.appendChild(itemEl);
        }
        card.appendChild(tray);
      }
    }

    if (infoOpen && !editing && tiddler) {
      const info = document.createElement('div');
      info.className = 'card-info-panel';
      const outgoing = app.store.getLinksFrom(title);
      const backlinks = app.store.getBacklinks(title);
      const fieldsArr = Object.entries(tiddler.fields || {});

      const linkButtons = (arr) => arr.length
        ? arr.map((x) => '<a class="wiki-link" data-tiddler="' + escapeHtml(x) + '" href="#' + encodeURIComponent(x) + '">' + escapeHtml(x) + '</a>').join(', ')
        : '<span class="muted">' + escapeHtml(t('noLinks', lang)) + '</span>';

      info.innerHTML =
        '<div class="info-grid">' +
          '<div class="info-box"><h4>' + escapeHtml(t('createdAt', lang)) + ' / ' + escapeHtml(t('modifiedAt', lang)) + '</h4>' +
            '<div>' + escapeHtml(formatDate(tiddler.created, lang)) + '</div>' +
            '<div class="muted">' + escapeHtml(formatDate(tiddler.modified, lang)) + '</div>' +
          '</div>' +
          '<div class="info-box"><h4>' + escapeHtml(t('outgoingLinks', lang)) + '</h4><div>' + linkButtons(outgoing) + '</div></div>' +
          '<div class="info-box"><h4>' + escapeHtml(t('backlinks', lang)) + '</h4><div>' + linkButtons(backlinks) + '</div></div>' +
          (fieldsArr.length
            ? '<div class="info-box"><h4>' + escapeHtml(t('fieldsLabel', lang)) + '</h4><div>' +
                fieldsArr.map(([k, v]) => '<code>' + escapeHtml(k) + '</code>: ' + escapeHtml(v)).join('<br>') +
              '</div></div>'
            : '') +
        '</div>' +
        '<div class="info-export-row">' +
          '<button type="button" class="btn btn-sm" data-exp-md>' + escapeHtml(t('exportMd', lang)) + '</button>' +
          '<button type="button" class="btn btn-sm" data-exp-tid>' + escapeHtml(t('exportTid', lang)) + '</button>' +
          '<button type="button" class="btn btn-sm" data-exp-json>' + escapeHtml(t('exportJson', lang)) + '</button>' +
          '<button type="button" class="btn btn-sm" data-info-rename>' + escapeHtml(t('rename', lang)) + '</button>' +
          (isOverridden
            ? '<button type="button" class="btn btn-sm btn-danger" data-info-reset>' + escapeHtml(t('resetShadow', lang)) + '</button>'
            : (!isShadow ? '<button type="button" class="btn btn-sm btn-danger" data-info-del>' + escapeHtml(t('delete', lang)) + '</button>' : '')) +
        '</div>';

      info.querySelector('[data-exp-md]').addEventListener('click', () => {
        downloadTextFile(exportMarkdown(tiddler), title.replace(/[^\w.-]+/g, '_') + '.md', 'text/markdown;charset=utf-8');
      });
      info.querySelector('[data-exp-tid]').addEventListener('click', () => {
        downloadTextFile(exportTid(tiddler), title.replace(/[^\w.-]+/g, '_') + '.tid', 'text/plain;charset=utf-8');
      });
      info.querySelector('[data-exp-json]').addEventListener('click', () => {
        downloadTextFile(exportJson([tiddler]), title.replace(/[^\w.-]+/g, '_') + '.json', 'application/json;charset=utf-8');
      });
      info.querySelector('[data-info-rename]').addEventListener('click', () => openRenameModal(app, title));

      const delBtn = info.querySelector('[data-info-del]');
      if (delBtn) delBtn.addEventListener('click', () => app.deleteCard(title));
      const resetBtn = info.querySelector('[data-info-reset]');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          app.store.delete(title);
          app.render();
        });
      }
      card.appendChild(info);
    }

    river.appendChild(card);
  }

  wireWikiContentInteractions(river, app, (el) => {
    const c = el.closest('[data-card-title]');
    return c ? c.getAttribute('data-card-title') : activeCard;
  });
  wireInteractiveWidgets(river, app, { resetTimers: true });
}
