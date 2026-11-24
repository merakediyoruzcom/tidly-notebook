import { parseTagString, formatTagString, twTimestamp } from './utils.js';
import { normalizeAttachments, csvToMarkdownTable } from './attachments.js';
import { isEncryptedEnvelope } from './crypto.js';
import { extractStoreFromHtml } from '../storage/serializer.js';

const STANDARD_KEYS = new Set(['title', 'text', 'tags', 'type', 'created', 'modified']);

function normalizeImportedRecord(raw, fallbackTitle = 'İçe Aktarılan') {
  const now = twTimestamp();
  const title = String(raw && raw.title ? raw.title : fallbackTitle).trim() || fallbackTitle;
  const tags = Array.isArray(raw && raw.tags)
    ? raw.tags.map((t) => String(t).trim()).filter(Boolean)
    : parseTagString(raw && raw.tags ? raw.tags : '');
  const fields = {};
  if (raw && raw.fields && typeof raw.fields === 'object') {
    for (const [k, v] of Object.entries(raw.fields)) {
      if (v !== undefined && v !== null) fields[String(k)] = String(v);
    }
  } else if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) {
      if (!STANDARD_KEYS.has(k) && k !== 'fields' && v !== undefined && v !== null) {
        fields[String(k)] = String(v);
      }
    }
  }
  return {
    title,
    text: String(raw && raw.text !== undefined ? raw.text : ''),
    tags,
    type: String((raw && raw.type) || 'text/vnd.tidly'),
    created: String((raw && raw.created) || now),
    modified: String((raw && raw.modified) || now),
    fields,
    attachments: normalizeAttachments(raw && raw.attachments)
  };
}

export function importCsv(csvText, fallbackTitle = 'CSV Tablosu') {
  const mdTable = csvToMarkdownTable(csvText);
  const now = twTimestamp();
  const title = String(fallbackTitle || 'CSV Tablosu').trim() || 'CSV Tablosu';
  const body = mdTable
    ? '# ' + title + '\n\n' + mdTable + '\n\n<<gradebook pass="50">>\n'
    : '# ' + title + '\n\n*(Boş CSV dosyası)*\n';
  return normalizeImportedRecord({
    title,
    text: body,
    tags: ['Tablo', 'Not Çizelgesi'],
    created: now,
    modified: now
  }, title);
}

export function exportJson(tiddlers) {
  return JSON.stringify(tiddlers, null, 2);
}

export function importJson(text) {
  const parsed = JSON.parse(String(text || '[]'));
  const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed && parsed.tiddlers) ? parsed.tiddlers : [parsed]);
  return arr.filter((x) => x && typeof x === 'object').map((x, idx) => normalizeImportedRecord(x, 'JSON #' + (idx + 1)));
}

export function exportTid(tiddler) {
  const lines = [];
  if (tiddler.created) lines.push('created: ' + tiddler.created);
  if (tiddler.modified) lines.push('modified: ' + tiddler.modified);
  if (tiddler.tags && tiddler.tags.length) lines.push('tags: ' + formatTagString(tiddler.tags));
  lines.push('title: ' + tiddler.title);
  if (tiddler.type) lines.push('type: ' + tiddler.type);
  const fieldKeys = Object.keys(tiddler.fields || {}).sort();
  for (const k of fieldKeys) {
    const val = String(tiddler.fields[k] || '').replace(/\r?\n/g, ' ');
    lines.push(k + ': ' + val);
  }
  lines.push('');
  lines.push(String(tiddler.text || ''));
  return lines.join('\n');
}

export function importTid(text, fallbackTitle = 'İçe Aktarılan') {
  const src = String(text || '').replace(/\r\n/g, '\n');
  const sepIdx = src.indexOf('\n\n');
  const headerBlock = sepIdx >= 0 ? src.slice(0, sepIdx) : src;
  const body = sepIdx >= 0 ? src.slice(sepIdx + 2) : '';
  const raw = { text: body, fields: {} };

  for (const line of headerBlock.split('\n')) {
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim();
    if (key === 'tags') raw.tags = parseTagString(val);
    else if (key === 'title' || key === 'type' || key === 'created' || key === 'modified') raw[key] = val;
    else raw.fields[key] = val;
  }

  return normalizeImportedRecord(raw, fallbackTitle);
}

export function exportMarkdown(tiddler) {
  const lines = ['---'];
  lines.push('title: ' + JSON.stringify(tiddler.title));
  if (tiddler.tags && tiddler.tags.length) {
    lines.push('tags: ' + JSON.stringify(tiddler.tags));
  }
  if (tiddler.created) lines.push('created: ' + JSON.stringify(tiddler.created));
  if (tiddler.modified) lines.push('modified: ' + JSON.stringify(tiddler.modified));
  const fieldKeys = Object.keys(tiddler.fields || {}).sort();
  for (const k of fieldKeys) {
    lines.push('field_' + k + ': ' + JSON.stringify(String(tiddler.fields[k])));
  }
  lines.push('---');
  lines.push('');
  lines.push(String(tiddler.text || ''));
  return lines.join('\n');
}

function parseYamlScalar(raw) {
  const s = raw.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    try {
      return s.startsWith('"') ? JSON.parse(s) : s.slice(1, -1);
    } catch {
      return s.slice(1, -1);
    }
  }
  if (s.startsWith('[') && s.endsWith(']')) {
    try {
      return JSON.parse(s);
    } catch {
      return s.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    }
  }
  return s;
}

export function importMarkdown(text, fallbackTitle = 'İçe Aktarılan') {
  const src = String(text || '').replace(/\r\n/g, '\n');
  const fmMatch = /^---\n([\s\S]*?)\n---\n?/.exec(src);
  if (!fmMatch) {
    return normalizeImportedRecord({ title: fallbackTitle, text: src }, fallbackTitle);
  }
  const raw = { text: src.slice(fmMatch[0].length).replace(/^\n/, ''), fields: {} };
  for (const line of fmMatch[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim();
    const val = parseYamlScalar(line.slice(colon + 1));
    if (key === 'title') raw.title = String(val);
    else if (key === 'tags') raw.tags = Array.isArray(val) ? val : parseTagString(String(val));
    else if (key === 'created' || key === 'modified' || key === 'type') raw[key] = String(val);
    else if (key.startsWith('field_')) raw.fields[key.slice(6)] = String(val);
    else raw.fields[key] = String(val);
  }
  return normalizeImportedRecord(raw, fallbackTitle);
}

export function importHtml(htmlText) {
  const src = String(htmlText || '');

  const tidlyStore = extractStoreFromHtml(src);
  if (tidlyStore) {
    if (isEncryptedEnvelope(tidlyStore)) {
      return { tiddlers: [], source: 'tidly', encrypted: true };
    }
    const list = Array.isArray(tidlyStore.tiddlers) ? tidlyStore.tiddlers : [];
    return {
      tiddlers: list.map((x, idx) => normalizeImportedRecord(x, 'Kart #' + (idx + 1))),
      source: 'tidly',
      encrypted: false
    };
  }

  const closeTag = '<' + '/script>';
  const tw5Marker = '<script class="tiddlywiki-tiddler-store" type="application/json">';
  const tw5Start = src.indexOf(tw5Marker);
  if (tw5Start >= 0) {
    const bodyStart = tw5Start + tw5Marker.length;
    const tw5End = src.indexOf(closeTag, bodyStart);
    if (tw5End > bodyStart) {
      const parsed = JSON.parse(src.slice(bodyStart, tw5End).trim());
      const arr = Array.isArray(parsed) ? parsed : [];
      const isTw5Enc = arr.some((item) => item && item.title === '$:/isEncrypted' && item.text === 'yes');
      if (isTw5Enc) {
        return { tiddlers: [], source: 'tiddlywiki5', encrypted: true };
      }
      return {
        tiddlers: arr.map((x, idx) => normalizeImportedRecord(x, 'TW5 #' + (idx + 1))),
        source: 'tiddlywiki5',
        encrypted: false
      };
    }
  }

  return { tiddlers: [], source: 'unknown', encrypted: false };
}
