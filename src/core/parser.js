import { escapeHtml, isSafeUrl } from './utils.js';
import { runFilter } from './filter.js';
import { t } from './i18n.js';
import { renderGradebookMacro, renderRecipeMacro, renderTimerMacro, renderCalcMacro } from './widgets.js';

const DEFAULT_MAX_DEPTH = 10;

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function expandTemplatePlaceholders(text, { title = '', now = new Date() } = {}) {
  const d = now instanceof Date ? now : new Date(now);
  const dateStr = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const timeStr = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  return String(text == null ? '' : text)
    .replace(/\$\{tarih\}|\$\{date\}/gi, dateStr)
    .replace(/\$\{saat\}|\$\{time\}/gi, timeStr)
    .replace(/\$\{baslik\}|\$\{title\}/gi, String(title || ''));
}

export function toggleTaskCheckbox(text, lineIndex) {
  const lines = String(text == null ? '' : text).split(/\r?\n/);
  if (lineIndex < 0 || lineIndex >= lines.length) return String(text == null ? '' : text);
  const line = lines[lineIndex];
  const m = /^(\s*[-*+]\s+\[)([ xX])(\]\s+.*)$/.exec(line);
  if (!m) return String(text == null ? '' : text);
  const nextMark = m[2] === ' ' ? 'x' : ' ';
  lines[lineIndex] = m[1] + nextMark + m[3];
  return lines.join('\n');
}

function collectMacrosFromText(text, map, strip) {
  const lines = String(text == null ? '' : text).split(/\r?\n/);
  const kept = [];
  let inFence = null;
  let active = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = /^\s*(```|~~~)/.exec(line);
    if (!active && fenceMatch) {
      if (!inFence) inFence = fenceMatch[1];
      else if (inFence === fenceMatch[1]) inFence = null;
      if (strip) kept.push(line);
      continue;
    }
    if (!inFence && !active) {
      const defMatch = /^\\define\s+([a-zA-Z0-9_-]+)\s*\(([^)]*)\)\s*(.*)$/.exec(line);
      if (defMatch) {
        const name = defMatch[1];
        const params = defMatch[2].split(',').map((s) => s.trim()).filter(Boolean);
        const inlineRest = defMatch[3].trim();
        if (inlineRest) {
          map.set(name, { params, body: inlineRest });
          if (strip) kept.push('');
        } else {
          active = { name, params, bodyLines: [] };
          if (strip) kept.push('');
        }
        continue;
      }
    }
    if (active) {
      if (/^\\end\s*$/.test(line)) {
        map.set(active.name, { params: active.params, body: active.bodyLines.join('\n') });
        active = null;
      } else {
        active.bodyLines.push(line);
      }
      if (strip) kept.push('');
      continue;
    }
    if (strip) kept.push(line);
  }
  return strip ? kept.join('\n') : '';
}

export function extractMacros(store, currentText = '') {
  const map = new Map();
  if (store) {
    const res = runFilter('[all[tiddlers]tag[$:/tags/Macro]sort[title]]', store);
    for (const title of res.titles) {
      collectMacrosFromText(store.getText(title), map, false);
    }
    const sysRes = runFilter('[all[system]tag[$:/tags/Macro]sort[title]]', store);
    for (const title of sysRes.titles) {
      collectMacrosFromText(store.getText(title), map, false);
    }
  }
  if (currentText) {
    collectMacrosFromText(currentText, map, false);
  }
  return map;
}

function parseMacroCall(raw) {
  const s = raw.trim();
  const spaceIdx = s.search(/\s/);
  const name = spaceIdx < 0 ? s : s.slice(0, spaceIdx);
  const rest = spaceIdx < 0 ? '' : s.slice(spaceIdx + 1).trim();
  const named = {};
  const positional = [];

  let i = 0;
  while (i < rest.length) {
    while (i < rest.length && /\s/.test(rest[i])) i++;
    if (i >= rest.length) break;

    const attrMatch = /^([a-zA-Z0-9_-]+)\s*[:=]\s*/.exec(rest.slice(i));
    let key = null;
    if (attrMatch) {
      key = attrMatch[1];
      i += attrMatch[0].length;
    }

    let val = '';
    const quote = rest[i];
    if (quote === '"' || quote === "'") {
      i++;
      const close = rest.indexOf(quote, i);
      if (close < 0) {
        val = rest.slice(i);
        i = rest.length;
      } else {
        val = rest.slice(i, close);
        i = close + 1;
      }
    } else {
      const start = i;
      while (i < rest.length && !/\s/.test(rest[i])) i++;
      val = rest.slice(start, i);
    }

    if (key) named[key] = val;
    else positional.push(val);
  }

  return { name, named, positional };
}

function resolveField(store, targetTitle, fieldName, currentTiddler) {
  const resolvedTitle = targetTitle || currentTiddler;
  if (!store || !resolvedTitle) return '';
  const item = store.get(resolvedTitle);
  if (!item) return '';
  if (fieldName === 'title') return item.title;
  if (fieldName === 'text') return item.text;
  if (fieldName === 'type') return item.type;
  if (fieldName === 'created') return item.created;
  if (fieldName === 'modified') return item.modified;
  if (fieldName === 'tags') return item.tags.join(', ');
  return item.fields && item.fields[fieldName] !== undefined ? item.fields[fieldName] : '';
}

function expandFieldTokensInString(raw, store, currentTiddler) {
  return String(raw || '').replace(/\{\{([^}\n]*!![^}\n]+)\}\}/g, (_, inner) => {
    const idx = inner.indexOf('!!');
    const target = inner.slice(0, idx).trim();
    const field = inner.slice(idx + 2).trim();
    return resolveField(store, target, field, currentTiddler);
  });
}

function renderTocBranch(store, tag, depth, maxDepth, visited) {
  if (depth > maxDepth) return '';
  const res = runFilter('[tag[' + tag + ']sort[title]]', store);
  if (res.error || !res.titles.length) return '';

  const items = [];
  for (const title of res.titles) {
    if (visited.has(title)) {
      items.push('<li><span class="toc-cycle">' + escapeHtml(title) + '</span></li>');
      continue;
    }
    const nextVisited = new Set(visited);
    nextVisited.add(title);
    const children = renderTocBranch(store, title, depth + 1, maxDepth, nextVisited);
    items.push(
      '<li><a class="wiki-link" data-tiddler="' + escapeHtml(title) + '" href="#' + encodeURIComponent(title) + '">' +
        escapeHtml(title) + '</a>' + children + '</li>'
    );
  }
  return '<ul class="toc-tree">' + items.join('') + '</ul>';
}

function renderMacroCall(rawCall, store, options) {
  const { currentTiddler = '', vars = {}, renderStack = [], maxDepth = DEFAULT_MAX_DEPTH, lang = 'tr', macros } = options;
  const { name, named, positional } = parseMacroCall(rawCall);

  if (name === 'currentTiddler') {
    return escapeHtml(currentTiddler);
  }

  if (name === 'count') {
    const filterExpr = named.filter !== undefined ? named.filter : (positional[0] || '');
    const res = runFilter(filterExpr, store, { currentTiddler });
    if (res.error) return '<span class="macro-error">' + escapeHtml(res.error) + '</span>';
    return '<span class="macro-count">' + res.titles.length + '</span>';
  }

  if (name === 'list') {
    const filterExpr = named.filter !== undefined ? named.filter : (positional[0] || '');
    const template = named.template || '';
    const emptyMsg = named.empty || '';
    const res = runFilter(filterExpr, store, { currentTiddler });
    if (res.error) return '<div class="macro-error">' + escapeHtml(res.error) + '</div>';
    if (!res.titles.length) {
      return emptyMsg ? '<p class="macro-empty">' + escapeHtml(emptyMsg) + '</p>' : '';
    }
    if (template) {
      const tplText = store ? store.getText(template) : '';
      const chunks = res.titles.map((title) => {
        const stackKey = 'template:' + template + ':' + title;
        if (renderStack.includes(stackKey) || renderStack.length >= maxDepth) {
          return '<div class="transclusion-cycle">' + escapeHtml(t('cycleWarning', lang, { title })) + '</div>';
        }
        return '<div class="macro-list-item">' + renderWikiText(tplText, store, {
          currentTiddler: title,
          vars,
          renderStack: [...renderStack, stackKey],
          maxDepth,
          lang
        }) + '</div>';
      });
      return '<div class="macro-list">' + chunks.join('') + '</div>';
    }
    const items = res.titles.map((title) => {
      const missing = store && !store.has(title) ? ' is-missing' : '';
      return '<li><a class="wiki-link' + missing + '" data-tiddler="' + escapeHtml(title) + '" href="#' + encodeURIComponent(title) + '">' +
        escapeHtml(title) + '</a></li>';
    });
    return '<ul class="macro-list">' + items.join('') + '</ul>';
  }

  if (name === 'toc') {
    const tag = named.tag !== undefined ? named.tag : (positional[0] || '');
    const depth = Math.min(8, Math.max(1, parseInt(named.depth || '4', 10) || 4));
    if (!tag) return '';
    return renderTocBranch(store, tag, 1, depth, new Set([tag])) || '<p class="macro-empty">' + escapeHtml(t('noLinks', lang)) + '</p>';
  }

  if (name === 'fields') {
    const item = store ? store.get(currentTiddler) : null;
    const entries = item && item.fields ? Object.entries(item.fields) : [];
    if (!entries.length) {
      return '<p class="macro-empty">' + escapeHtml(t('noLinks', lang)) + '</p>';
    }
    const rows = entries.map(([k, v]) =>
      '<tr><th>' + escapeHtml(k) + '</th><td>' + escapeHtml(v) + '</td></tr>'
    ).join('');
    return '<div class="table-wrap"><table class="fields-table"><tbody>' + rows + '</tbody></table></div>';
  }

  if (name === 'new-card') {
    const label = named.label || positional[0] || t('newCard', lang);
    const tpl = named.template || '';
    const tags = named.tags || '';
    const title = named.title || '';
    return '<button type="button" class="action-macro-btn" data-action="new-card" data-template="' +
      escapeHtml(tpl) + '" data-tags="' + escapeHtml(tags) + '" data-title="' + escapeHtml(title) + '">' +
      escapeHtml(label) + '</button>';
  }

  if (name === 'set-field') {
    const target = named.tiddler || currentTiddler;
    const field = named.field || '';
    const value = named.value !== undefined ? named.value : '';
    const label = named.label || (field + ' = ' + value);
    return '<button type="button" class="action-macro-btn" data-action="set-field" data-tiddler="' +
      escapeHtml(target) + '" data-field="' + escapeHtml(field) + '" data-value="' + escapeHtml(value) + '">' +
      escapeHtml(label) + '</button>';
  }

  if (name === 'gradebook') {
    const threshold = named.pass !== undefined ? named.pass : (positional[0] || '50');
    const cardText = store && currentTiddler ? store.getText(currentTiddler, '') : '';
    return renderGradebookMacro(cardText, currentTiddler, threshold, lang);
  }

  if (name === 'recipe') {
    const servings = named.servings !== undefined ? named.servings : (positional[0] || '4');
    const cardText = store && currentTiddler ? store.getText(currentTiddler, '') : '';
    return renderRecipeMacro(cardText, currentTiddler, servings, lang);
  }

  if (name === 'timer') {
    const minutes = named.minutes !== undefined ? named.minutes : (positional[0] || '15');
    const label = named.label !== undefined ? named.label : (positional[1] || '');
    return renderTimerMacro(minutes, label, lang);
  }

  if (name === 'calc') {
    const type = named.type !== undefined ? named.type : (positional[0] || 'bmi');
    return renderCalcMacro(type, lang);
  }

  const macroDef = macros && macros.get(name);
  if (macroDef) {
    const stackKey = 'macro:' + name;
    if (renderStack.includes(stackKey) || renderStack.length >= maxDepth) {
      return '<span class="transclusion-cycle">' + escapeHtml(t('cycleWarning', lang, { title: name })) + '</span>';
    }
    let body = macroDef.body;
    const nextVars = { ...vars };
    macroDef.params.forEach((p, idx) => {
      const val = named[p] !== undefined ? named[p] : (positional[idx] !== undefined ? positional[idx] : '');
      nextVars[p] = val;
      body = body.replaceAll('$' + p + '$', val);
    });
    for (const [k, v] of Object.entries(nextVars)) {
      body = body.replaceAll('$(' + k + ')$', String(v));
    }
    return renderWikiText(body, store, {
      currentTiddler,
      vars: nextVars,
      renderStack: [...renderStack, stackKey],
      maxDepth,
      lang
    });
  }

  return escapeHtml('<<' + rawCall + '>>');
}

function renderTransclusion(rawInner, isBlock, store, options) {
  const { currentTiddler = '', vars = {}, renderStack = [], maxDepth = DEFAULT_MAX_DEPTH, lang = 'tr' } = options;
  const fieldIdx = rawInner.indexOf('!!');
  if (fieldIdx >= 0) {
    const target = rawInner.slice(0, fieldIdx).trim();
    const field = rawInner.slice(fieldIdx + 2).trim();
    const val = resolveField(store, target, field, currentTiddler);
    return isBlock ? '<p class="transclusion-field">' + escapeHtml(val) + '</p>' : escapeHtml(val);
  }

  const target = rawInner.trim();
  if (!target) return '';
  if (!store || !store.has(target)) {
    const msg = t('missingTransclusion', lang, { title: target });
    return '<span class="transclusion-missing">' + escapeHtml(msg) + '</span>';
  }
  const stackKey = 'card:' + target;
  if (renderStack.includes(stackKey) || renderStack.length >= maxDepth) {
    const msg = t('cycleWarning', lang, { title: target });
    return '<span class="transclusion-cycle">' + escapeHtml(msg) + '</span>';
  }

  const targetText = store.getText(target);
  const innerHtml = renderWikiText(targetText, store, {
    currentTiddler: target,
    vars,
    renderStack: [...renderStack, stackKey],
    maxDepth,
    lang
  });

  if (isBlock) {
    return '<div class="transclusion" data-transcluded="' + escapeHtml(target) + '">' + innerHtml + '</div>';
  }
  return '<span class="transclusion-inline" data-transcluded="' + escapeHtml(target) + '">' + innerHtml + '</span>';
}

function renderInline(raw, store, options) {
  const tokens = [];
  const hold = (html) => {
    const idx = tokens.length;
    tokens.push(html);
    return '\uE000T' + idx + '\uE001';
  };

  let s = String(raw == null ? '' : raw);

  // 1. Protect inline code first
  s = s.replace(/`([^`\n]+)`/g, (_, code) => hold('<code>' + escapeHtml(code) + '</code>'));

  // 2. Protect macros <<...>>
  s = s.replace(/<<([^>\n]+)>>/g, (_, inner) => hold(renderMacroCall(inner, store, options)));

  // 3. Protect wiki links [[...]] BEFORE transclusions/md links so [[{{!!title}}]] resolves
  s = s.replace(/\[\[([^\]\n]+)\]\]/g, (_, inner) => {
    const pipeIdx = inner.indexOf('|');
    const rawLabel = pipeIdx >= 0 ? inner.slice(0, pipeIdx) : inner;
    const rawTarget = pipeIdx >= 0 ? inner.slice(pipeIdx + 1) : inner;
    const label = expandFieldTokensInString(rawLabel, store, options.currentTiddler).trim();
    const target = expandFieldTokensInString(rawTarget, store, options.currentTiddler).trim();
    if (!target) return escapeHtml('[[' + inner + ']]');
    const missing = store && !store.has(target) ? ' is-missing' : '';
    return hold(
      '<a class="wiki-link' + missing + '" data-tiddler="' + escapeHtml(target) + '" href="#' + encodeURIComponent(target) + '">' +
      escapeHtml(label || target) + '</a>'
    );
  });

  // 4. Protect transclusions {{...}}
  s = s.replace(/\{\{([^}\n]+)\}\}/g, (_, inner) => hold(renderTransclusion(inner, false, store, options)));

  // 5. Protect images ![alt](url)
  s = s.replace(/!\[([^\]\n]*)\]\(([^)\s]+)\)/g, (full, alt, url) => {
    if (!isSafeUrl(url, true)) return escapeHtml(full);
    return hold('<img class="wiki-img" src="' + escapeHtml(url) + '" alt="' + escapeHtml(alt) + '" loading="lazy">');
  });

  // 6. Protect markdown links [text](url)
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (full, label, url) => {
    if (!isSafeUrl(url, false)) return escapeHtml(full);
    const ext = url.startsWith('#') ? '' : ' target="_blank" rel="noopener noreferrer"';
    return hold('<a href="' + escapeHtml(url) + '"' + ext + '>' + escapeHtml(label) + '</a>');
  });

  // 7. Escape all remaining raw HTML in prose
  s = escapeHtml(s);

  // 8. Safe inline formatting on escaped text
  s = s.replace(/\*\*([^\n*]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^\n*]+?)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/~~([^\n~]+?)~~/g, '<del>$1</del>');
  s = s.replace(/==([^\n=]+?)==/g, '<mark>$1</mark>');

  // 9. Restore tokens
  return s.replace(/\uE000T(\d+)\uE001/g, (_, idx) => tokens[Number(idx)] || '');
}

function splitTableRow(line) {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map((c) => c.trim());
}

export function renderWikiText(text, store, options = {}) {
  const {
    currentTiddler = '',
    vars = {},
    renderStack = [],
    maxDepth = DEFAULT_MAX_DEPTH,
    lang = 'tr'
  } = options;

  const macros = extractMacros(store, text);
  const macroMap = new Map(macros);
  const cleanedText = collectMacrosFromText(text, macroMap, true);
  const ctx = { currentTiddler, vars, renderStack, maxDepth, lang, macros: macroMap };

  const lines = cleanedText.split(/\r?\n/);
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    // Fenced code block
    const fenceMatch = /^\s*(```|~~~)(.*)$/.exec(line);
    if (fenceMatch) {
      const fence = fenceMatch[1];
      const codeLang = fenceMatch[2].trim();
      i++;
      const codeLines = [];
      while (i < lines.length && !lines[i].trim().startsWith(fence)) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      const rawCode = codeLines.join('\n');
      blocks.push(
        '<div class="code-block">' +
          '<div class="code-head"><span>' + escapeHtml(codeLang || 'text') + '</span>' +
          '<button type="button" class="copy-code-btn" data-copy-code="1">' + escapeHtml(lang === 'en' ? 'Copy' : 'Kopyala') + '</button></div>' +
          '<pre><code>' + escapeHtml(rawCode) + '</code></pre>' +
        '</div>'
      );
      continue;
    }

    // Heading
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push('<h' + level + '>' + renderInline(headingMatch[2].trim(), store, ctx) + '</h' + level + '>');
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push('<hr>');
      i++;
      continue;
    }

    // Standalone block transclusion {{Target}}
    const transMatch = /^\s*\{\{([^}\n]+)\}\}\s*$/.exec(line);
    if (transMatch) {
      blocks.push(renderTransclusion(transMatch[1], true, store, ctx));
      i++;
      continue;
    }

    // Standalone block macro <<...>>
    const macroBlockMatch = /^\s*<<([^>\n]+)>>\s*$/.exec(line);
    if (macroBlockMatch) {
      const html = renderMacroCall(macroBlockMatch[1], store, ctx);
      if (/^<(ul|div|table|p|button)\b/i.test(html)) {
        blocks.push(html);
      } else if (html) {
        blocks.push('<p>' + html + '</p>');
      }
      i++;
      continue;
    }

    // Blockquote / Callout
    if (/^\s*>\s?/.test(line)) {
      const qLines = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        qLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      const calloutMatch = /^\[!(NOT|İPUCU|IPUCU|UYARI|NOTE|TIP|WARNING)\]\s*(.*)$/i.exec(qLines[0] || '');
      if (calloutMatch) {
        const rawKind = calloutMatch[1].toUpperCase();
        const kindMap = {
          NOT: 'note',
          NOTE: 'note',
          İPUCU: 'tip',
          IPUCU: 'tip',
          TIP: 'tip',
          UYARI: 'warning',
          WARNING: 'warning'
        };
        const kind = kindMap[rawKind] || 'note';
        const titleLabel = rawKind;
        const bodyLines = [];
        if (calloutMatch[2]) bodyLines.push(calloutMatch[2]);
        for (let q = 1; q < qLines.length; q++) bodyLines.push(qLines[q]);
        blocks.push(
          '<div class="callout callout-' + kind + '">' +
            '<div class="callout-title">' + escapeHtml(titleLabel) + '</div>' +
            '<div class="callout-body">' + renderInline(bodyLines.join(' '), store, ctx) + '</div>' +
          '</div>'
        );
      } else {
        blocks.push('<blockquote><p>' + renderInline(qLines.join(' '), store, ctx) + '</p></blockquote>');
      }
      continue;
    }

    // Markdown table
    if (
      i + 1 < lines.length &&
      lines[i].includes('|') &&
      /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*(?::?-+:?\s*\|?)?\s*$/.test(lines[i + 1])
    ) {
      const headers = splitTableRow(lines[i]);
      i += 2;
      const bodyRows = [];
      while (i < lines.length && lines[i].includes('|') && !/^\s*$/.test(lines[i])) {
        bodyRows.push(splitTableRow(lines[i]));
        i++;
      }
      const headHtml = '<thead><tr>' + headers.map((h) => '<th>' + renderInline(h, store, ctx) + '</th>').join('') + '</tr></thead>';
      const bodyHtml = '<tbody>' + bodyRows.map((row) =>
        '<tr>' + headers.map((_, idx) => '<td>' + renderInline(row[idx] || '', store, ctx) + '</td>').join('') + '</tr>'
      ).join('') + '</tbody>';
      blocks.push('<div class="table-wrap"><table>' + headHtml + bodyHtml + '</table></div>');
      continue;
    }

    // Unordered / Task list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        const content = lines[i].replace(/^\s*[-*+]\s+/, '');
        const taskMatch = /^\[([ xX])\]\s+(.*)$/.exec(content);
        if (taskMatch) {
          const checked = taskMatch[1] !== ' ' ? ' checked' : '';
          items.push(
            '<li class="task-item"><label>' +
              '<input type="checkbox" data-task-line="' + i + '" data-task-tiddler="' + escapeHtml(currentTiddler) + '"' + checked + '> ' +
              '<span>' + renderInline(taskMatch[2], store, ctx) + '</span>' +
            '</label></li>'
          );
        } else {
          items.push('<li>' + renderInline(content, store, ctx) + '</li>');
        }
        i++;
      }
      blocks.push('<ul>' + items.join('') + '</ul>');
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const content = lines[i].replace(/^\s*\d+\.\s+/, '');
        items.push('<li>' + renderInline(content, store, ctx) + '</li>');
        i++;
      }
      blocks.push('<ol>' + items.join('') + '</ol>');
      continue;
    }

    // Paragraph
    const pLines = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^\s*(```|~~~)/.test(lines[i]) &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) &&
      !/^\s*\{\{[^}\n]+\}\}\s*$/.test(lines[i]) &&
      !/^\s*<<[^>\n]+>>\s*$/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      pLines.push(lines[i]);
      i++;
    }
    if (pLines.length) {
      blocks.push('<p>' + pLines.map((l) => renderInline(l, store, ctx)).join('<br>') + '</p>');
    } else {
      i++;
    }
  }

  return blocks.join('\n');
}
