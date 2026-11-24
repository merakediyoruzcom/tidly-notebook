import { escapeHtml } from '../core/utils.js';
import { t } from '../core/i18n.js';
import { validateAttachment, formatBytes, csvToMarkdownTable } from '../core/attachments.js';
import { renderWikiText } from '../core/parser.js';
import { runFilter } from '../core/filter.js';
import { icon } from './icons.js';

function insertAtCursor(textarea, before, after = '', placeholder = '') {
  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const value = textarea.value;
  const selected = value.slice(start, end) || placeholder;
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  textarea.value = next;
  const cursorStart = start + before.length;
  const cursorEnd = cursorStart + selected.length;
  textarea.focus();
  textarea.setSelectionRange(cursorStart, cursorEnd);
  textarea.dispatchEvent(new Event('input'));
}

export function renderEditor(container, tiddler, app, initialMode = 'write') {
  const lang = app.lang();
  const originalTitle = tiddler.title;
  let tags = [...(tiddler.tags || [])];
  const fields = Object.entries(tiddler.fields || {}).map(([k, v]) => ({ k, v }));
  const attachments = [...(tiddler.attachments || [])];
  let mode = initialMode;

  const wrap = document.createElement('div');
  wrap.className = 'editor-wrap';

  wrap.innerHTML =
    '<div class="editor-meta-grid">' +
      '<input class="input editor-title-input" data-edit-title type="text" placeholder="' + escapeHtml(t('titlePlaceholder', lang)) + '" value="' + escapeHtml(tiddler.title) + '">' +
      '<select class="select" data-edit-type aria-label="' + escapeHtml(t('typeLabel', lang)) + '" style="width:auto;">' +
        '<option value="text/vnd.tidly"' + (tiddler.type === 'text/vnd.tidly' ? ' selected' : '') + '>Markdown / WikiText</option>' +
        '<option value="text/plain"' + (tiddler.type === 'text/plain' ? ' selected' : '') + '>Düz Metin</option>' +
        '<option value="text/css"' + (tiddler.type === 'text/css' ? ' selected' : '') + '>CSS ($:/tags/Stylesheet)</option>' +
        '<option value="application/json"' + (tiddler.type === 'application/json' ? ' selected' : '') + '>JSON</option>' +
      '</select>' +
    '</div>' +
    '<div>' +
      '<div class="tag-input-row">' +
        '<input class="input" data-tag-input type="text" list="tidly-tag-datalist" placeholder="' + escapeHtml(t('tagsPlaceholder', lang)) + '">' +
        '<button type="button" class="btn btn-sm" data-add-tag>' + escapeHtml(t('addTag', lang)) + '</button>' +
      '</div>' +
      '<datalist id="tidly-tag-datalist"></datalist>' +
      '<div class="tag-row" data-tag-list></div>' +
    '</div>' +
    '<div class="fields-editor">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;">' +
        '<span class="settings-label">' + escapeHtml(t('fieldsLabel', lang)) + '</span>' +
        '<button type="button" class="btn btn-sm" data-add-field>+ ' + escapeHtml(t('addField', lang)) + '</button>' +
      '</div>' +
      '<div data-fields-list style="display:flex;flex-direction:column;gap:6px;"></div>' +
    '</div>' +
    '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;">' +
      '<div class="editor-mode-tabs">' +
        '<button type="button" class="btn btn-sm" data-mode="write">' + escapeHtml(t('modeWrite', lang)) + '</button>' +
        '<button type="button" class="btn btn-sm" data-mode="preview">' + escapeHtml(t('modePreview', lang)) + '</button>' +
        '<button type="button" class="btn btn-sm" data-mode="split">' + escapeHtml(t('modeSplit', lang)) + '</button>' +
      '</div>' +
    '</div>' +
    '<div class="editor-toolbar" role="toolbar" aria-label="Formatting">' +
      '<button type="button" class="btn btn-sm" data-fmt="h2">H2</button>' +
      '<button type="button" class="btn btn-sm" data-fmt="bold"><strong>B</strong></button>' +
      '<button type="button" class="btn btn-sm" data-fmt="italic"><em>I</em></button>' +
      '<button type="button" class="btn btn-sm" data-fmt="link">[[ ]]</button>' +
      '<button type="button" class="btn btn-sm" data-fmt="trans">{{ }}</button>' +
      '<button type="button" class="btn btn-sm" data-fmt="task">[ ]</button>' +
      '<button type="button" class="btn btn-sm" data-fmt="code">Kod</button>' +
      '<button type="button" class="btn btn-sm" data-fmt="table">Tablo</button>' +
      '<button type="button" class="btn btn-sm" data-fmt="callout">Not</button>' +
      '<button type="button" class="btn btn-sm" data-fmt="csv">' + icon('table', 14) + ' <span>' + escapeHtml(t('insertCsvTable', lang)) + '</span></button>' +
      '<input type="file" accept=".csv" data-csv-input style="display:none;">' +
    '</div>' +
    '<div class="editor-split-area" data-split-area>' +
      '<div class="editor-textarea-wrap" data-write-pane>' +
        '<textarea class="textarea" data-edit-text placeholder="' + escapeHtml(t('editorPlaceholder', lang)) + '"></textarea>' +
        '<div class="link-suggest-pop" data-suggest-pop style="display:none;"></div>' +
      '</div>' +
      '<div class="preview-box card-body" data-preview-pane style="display:none;"></div>' +
    '</div>' +
    '<div class="fields-editor" data-att-box>' +
      '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px;">' +
        '<span class="settings-label">' + escapeHtml(t('attachmentsLabel', lang)) + '</span>' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
          '<input type="file" multiple data-att-input style="display:none;">' +
          '<button type="button" class="btn btn-sm" data-add-att>' + icon('paperclip', 14) + ' <span>' + escapeHtml(t('addAttachment', lang)) + '</span></button>' +
        '</div>' +
      '</div>' +
      '<span class="muted" style="font-size:0.76rem;">' + escapeHtml(t('attachmentLimitHint', lang)) + '</span>' +
      '<div class="att-list" data-att-list></div>' +
    '</div>' +
    '<div class="error-msg" data-edit-error></div>' +
    '<div class="editor-footer">' +
      '<button type="button" class="btn" data-edit-cancel>' + escapeHtml(t('cancel', lang)) + '</button>' +
      '<button type="button" class="btn btn-primary" data-edit-save>' + icon('check', 16) + ' <span>' + escapeHtml(t('save', lang)) + '</span></button>' +
    '</div>';

  container.innerHTML = '';
  container.appendChild(wrap);

  const titleEl = wrap.querySelector('[data-edit-title]');
  const typeEl = wrap.querySelector('[data-edit-type]');
  const tagInputEl = wrap.querySelector('[data-tag-input]');
  const tagListEl = wrap.querySelector('[data-tag-list]');
  const datalistEl = wrap.querySelector('#tidly-tag-datalist');
  const fieldsListEl = wrap.querySelector('[data-fields-list]');
  const splitAreaEl = wrap.querySelector('[data-split-area]');
  const writePaneEl = wrap.querySelector('[data-write-pane]');
  const previewPaneEl = wrap.querySelector('[data-preview-pane]');
  const textareaEl = wrap.querySelector('[data-edit-text]');
  const suggestPopEl = wrap.querySelector('[data-suggest-pop]');
  const errEl = wrap.querySelector('[data-edit-error]');
  const attListEl = wrap.querySelector('[data-att-list]');
  const attInputEl = wrap.querySelector('[data-att-input]');
  const csvInputEl = wrap.querySelector('[data-csv-input]');

  const renderAttachments = () => {
    attListEl.innerHTML = '';
    attachments.forEach((att, idx) => {
      const row = document.createElement('div');
      row.className = 'att-item';
      row.innerHTML =
        '<div class="att-meta">' +
          '<span class="att-badge">' + escapeHtml((att.name.split('.').pop() || 'FILE').toUpperCase()) + '</span>' +
          '<span class="att-name">' + escapeHtml(att.name) + '</span>' +
          '<span class="muted">' + escapeHtml(formatBytes(att.size)) + '</span>' +
        '</div>' +
        '<button type="button" class="icon-btn" data-att-del aria-label="Remove attachment">' + icon('trash', 15) + '</button>';
      row.querySelector('[data-att-del]').addEventListener('click', () => {
        attachments.splice(idx, 1);
        renderAttachments();
      });
      attListEl.appendChild(row);
    });
  };

  wrap.querySelector('[data-add-att]').addEventListener('click', () => attInputEl.click());
  attInputEl.addEventListener('change', () => {
    errEl.textContent = '';
    const files = Array.from(attInputEl.files || []);
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => {
        const res = validateAttachment({
          name: file.name,
          mime: file.type,
          size: file.size,
          dataUrl: String(reader.result || '')
        });
        if (!res.ok) {
          errEl.textContent = res.error;
          return;
        }
        attachments.push(res.attachment);
        renderAttachments();
      };
      reader.readAsDataURL(file);
    }
    attInputEl.value = '';
  });

  csvInputEl.addEventListener('change', async () => {
    const file = csvInputEl.files && csvInputEl.files[0];
    if (!file) return;
    const text = await file.text();
    const md = csvToMarkdownTable(text);
    if (md) insertAtCursor(textareaEl, '\n' + md + '\n', '', '');
    csvInputEl.value = '';
  });

  textareaEl.value = tiddler.text || '';

  for (const tagInfo of app.store.getAllTags({ includeSystem: true })) {
    const opt = document.createElement('option');
    opt.value = tagInfo.tag;
    datalistEl.appendChild(opt);
  }

  const renderTags = () => {
    tagListEl.innerHTML = '';
    tags.forEach((tg, idx) => {
      const pill = document.createElement('span');
      pill.className = 'tag-pill' + (tg.startsWith('$:/') ? ' is-system' : '');
      pill.innerHTML = '<span>' + escapeHtml(tg) + '</span>';
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'tag-remove-btn';
      rm.setAttribute('aria-label', 'Remove ' + tg);
      rm.textContent = '×';
      rm.addEventListener('click', () => {
        tags.splice(idx, 1);
        renderTags();
      });
      pill.appendChild(rm);
      tagListEl.appendChild(pill);
    });
  };

  const addTagFromInput = () => {
    const val = tagInputEl.value.trim();
    if (!val) return;
    if (!tags.includes(val)) tags.push(val);
    tagInputEl.value = '';
    renderTags();
  };

  wrap.querySelector('[data-add-tag]').addEventListener('click', addTagFromInput);
  tagInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTagFromInput();
    }
  });

  const renderFields = () => {
    fieldsListEl.innerHTML = '';
    fields.forEach((f, idx) => {
      const row = document.createElement('div');
      row.className = 'field-row';
      row.innerHTML =
        '<input class="input" type="text" data-fkey placeholder="' + escapeHtml(t('fieldNamePlaceholder', lang)) + '" value="' + escapeHtml(f.k) + '">' +
        '<input class="input" type="text" data-fval placeholder="' + escapeHtml(t('fieldValuePlaceholder', lang)) + '" value="' + escapeHtml(f.v) + '">' +
        '<button type="button" class="icon-btn" data-fdel aria-label="Remove field">' + icon('trash', 16) + '</button>';
      row.querySelector('[data-fkey]').addEventListener('input', (e) => { f.k = e.target.value; });
      row.querySelector('[data-fval]').addEventListener('input', (e) => { f.v = e.target.value; });
      row.querySelector('[data-fdel]').addEventListener('click', () => {
        fields.splice(idx, 1);
        renderFields();
      });
      fieldsListEl.appendChild(row);
    });
  };

  wrap.querySelector('[data-add-field]').addEventListener('click', () => {
    fields.push({ k: '', v: '' });
    renderFields();
  });

  const updatePreview = () => {
    const curTitle = titleEl.value.trim() || originalTitle;
    previewPaneEl.innerHTML = renderWikiText(textareaEl.value, app.store, {
      currentTiddler: curTitle,
      lang
    });
  };

  const syncMode = () => {
    wrap.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.classList.toggle('btn-primary', btn.getAttribute('data-mode') === mode);
    });
    splitAreaEl.classList.toggle('is-split', mode === 'split');
    writePaneEl.style.display = mode === 'preview' ? 'none' : 'block';
    previewPaneEl.style.display = mode === 'write' ? 'none' : 'block';
    if (mode !== 'write') updatePreview();
  };

  wrap.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.getAttribute('data-mode');
      syncMode();
    });
  });

  wrap.querySelectorAll('[data-fmt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const fmt = btn.getAttribute('data-fmt');
      if (fmt === 'h2') insertAtCursor(textareaEl, '## ', '', 'Başlık');
      else if (fmt === 'bold') insertAtCursor(textareaEl, '**', '**', 'kalın');
      else if (fmt === 'italic') insertAtCursor(textareaEl, '*', '*', 'italik');
      else if (fmt === 'link') insertAtCursor(textareaEl, '[[', ']]', 'Kart Başlığı');
      else if (fmt === 'trans') insertAtCursor(textareaEl, '{{', '}}', 'Kart Başlığı');
      else if (fmt === 'task') insertAtCursor(textareaEl, '- [ ] ', '', 'Görev');
      else if (fmt === 'code') insertAtCursor(textareaEl, '```\n', '\n```', 'kod');
      else if (fmt === 'table') insertAtCursor(textareaEl, '| Sütun 1 | Sütun 2 |\n| --- | --- |\n| Değer 1 | Değer 2 |\n', '', '');
      else if (fmt === 'callout') insertAtCursor(textareaEl, '> [!NOT]\n> ', '', 'Not metni');
      else if (fmt === 'csv') csvInputEl.click();
    });
  });

  const updateSuggest = () => {
    const pos = textareaEl.selectionStart || 0;
    const before = textareaEl.value.slice(0, pos);
    const match = /\[\[([^\]|\n]*)$/.exec(before);
    if (!match) {
      suggestPopEl.style.display = 'none';
      return;
    }
    const q = match[1].trim();
    const titles = runFilter(
      q ? '[all[tiddlers]search[' + q.replace(/\]/g, '') + ']sort[title]limit[6]]' : '[all[tiddlers]!sort[modified]limit[6]]',
      app.store
    ).titles;
    if (!titles.length) {
      suggestPopEl.style.display = 'none';
      return;
    }
    suggestPopEl.innerHTML = '';
    for (const candidate of titles) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'link-suggest-item';
      btn.textContent = candidate;
      btn.addEventListener('click', () => {
        const startIdx = before.length - match[1].length;
        const tail = textareaEl.value.slice(pos);
        const closeSuffix = tail.startsWith(']]') ? '' : ']]';
        textareaEl.value = textareaEl.value.slice(0, startIdx) + candidate + closeSuffix + tail;
        const nextPos = startIdx + candidate.length + closeSuffix.length;
        textareaEl.focus();
        textareaEl.setSelectionRange(nextPos, nextPos);
        suggestPopEl.style.display = 'none';
        if (mode === 'split') updatePreview();
      });
      suggestPopEl.appendChild(btn);
    }
    suggestPopEl.style.display = 'block';
  };

  textareaEl.addEventListener('input', () => {
    updateSuggest();
    if (mode === 'split') updatePreview();
  });

  // Safe image drop into editor (max 1.5 MB raster images only; SVG blocked)
  textareaEl.addEventListener('dragover', (e) => {
    if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
      e.preventDefault();
    }
  });
  textareaEl.addEventListener('drop', (e) => {
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    if (/^image\/(png|jpeg|jpg|gif|webp)$/i.test(file.type)) {
      e.preventDefault();
      e.stopPropagation();
      if (file.size > 1500000) {
        errEl.textContent = 'Görsel boyutu 1.5 MB sınırını aşıyor.';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        insertAtCursor(textareaEl, '\n![' + file.name + '](' + String(reader.result) + ')\n', '', '');
      };
      reader.readAsDataURL(file);
    }
  });

  const doSave = () => {
    const nextTitle = titleEl.value.trim();
    if (!nextTitle) {
      errEl.textContent = t('renameErrorEmpty', lang);
      titleEl.focus();
      return;
    }
    if (nextTitle !== originalTitle && app.store.has(nextTitle)) {
      errEl.textContent = t('renameErrorExists', lang, { title: nextTitle });
      titleEl.focus();
      return;
    }
    const nextFields = {};
    for (const f of fields) {
      const k = f.k.trim();
      if (k) nextFields[k] = String(f.v || '');
    }
    app.saveEdit(originalTitle, {
      title: nextTitle,
      text: textareaEl.value,
      tags,
      type: typeEl.value,
      fields: nextFields,
      attachments
    });
  };

  textareaEl.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      doSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      app.cancelEdit(originalTitle);
    }
  });

  wrap.querySelector('[data-edit-save]').addEventListener('click', doSave);
  wrap.querySelector('[data-edit-cancel]').addEventListener('click', () => app.cancelEdit(originalTitle));

  renderTags();
  renderFields();
  renderAttachments();
  syncMode();
  setTimeout(() => textareaEl.focus(), 10);
}
