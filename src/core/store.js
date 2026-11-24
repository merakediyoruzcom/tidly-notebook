import { trCompare, twTimestamp, deepClone } from './utils.js';
import { normalizeAttachments } from './attachments.js';

const MAX_UNDO_STEPS = 50;

function splitCodeSegments(text) {
  const src = String(text == null ? '' : text);
  const segments = [];
  // Match fenced code blocks (``` or ~~~) or inline backtick spans
  const codeRe = /(^|\n)(```[^\n]*\n[\s\S]*?\n```(?=\n|$)|~~~[^\n]*\n[\s\S]*?\n~~~(?=\n|$))|`[^`\n]+`/g;
  let lastIndex = 0;
  let match;
  while ((match = codeRe.exec(src)) !== null) {
    let start = match.index;
    let codeText = match[0];
    if (match[1]) {
      start += match[1].length;
      codeText = match[2];
    }
    if (start > lastIndex) {
      segments.push({ isCode: false, text: src.slice(lastIndex, start) });
    }
    segments.push({ isCode: true, text: codeText });
    lastIndex = start + codeText.length;
  }
  if (lastIndex < src.length) {
    segments.push({ isCode: false, text: src.slice(lastIndex) });
  }
  return segments;
}

export function extractLinksFromText(text) {
  const links = [];
  const seen = new Set();
  const addLink = (target) => {
    const clean = String(target || '').trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      links.push(clean);
    }
  };

  for (const seg of splitCodeSegments(text)) {
    if (seg.isCode) continue;
    const linkRe = /\[\[([^\]\n]+)\]\]|\{\{([^}\n]+)\}\}/g;
    let m;
    while ((m = linkRe.exec(seg.text)) !== null) {
      if (m[1] !== undefined) {
        const inner = m[1];
        const pipeIdx = inner.indexOf('|');
        addLink(pipeIdx >= 0 ? inner.slice(pipeIdx + 1) : inner);
      } else if (m[2] !== undefined) {
        const inner = m[2];
        const fieldIdx = inner.indexOf('!!');
        if (fieldIdx === 0) continue; // {{!!field}} targets current tiddler
        addLink(fieldIdx > 0 ? inner.slice(0, fieldIdx) : inner);
      }
    }
  }
  return links;
}

export function rewriteLinksInText(text, oldTitle, newTitle) {
  if (!oldTitle || oldTitle === newTitle) return String(text == null ? '' : text);
  const parts = splitCodeSegments(text).map((seg) => {
    if (seg.isCode) return seg.text;
    return seg.text.replace(/\[\[([^\]\n]+)\]\]|\{\{([^}\n]+)\}\}/g, (full, linkInner, transInner) => {
      if (linkInner !== undefined) {
        const pipeIdx = linkInner.indexOf('|');
        if (pipeIdx < 0) {
          return linkInner.trim() === oldTitle ? '[[' + newTitle + ']]' : full;
        }
        const label = linkInner.slice(0, pipeIdx);
        const target = linkInner.slice(pipeIdx + 1).trim();
        return target === oldTitle ? '[[' + label + '|' + newTitle + ']]' : full;
      }
      if (transInner !== undefined) {
        const fieldIdx = transInner.indexOf('!!');
        if (fieldIdx === 0) return full;
        if (fieldIdx > 0) {
          const target = transInner.slice(0, fieldIdx).trim();
          const fieldPart = transInner.slice(fieldIdx + 2);
          return target === oldTitle ? '{{' + newTitle + '!!' + fieldPart + '}}' : full;
        }
        return transInner.trim() === oldTitle ? '{{' + newTitle + '}}' : full;
      }
      return full;
    });
  });
  return parts.join('');
}

function normalizeFields(rawFields) {
  const out = {};
  if (!rawFields || typeof rawFields !== 'object') return out;
  for (const [k, v] of Object.entries(rawFields)) {
    const key = String(k).trim();
    if (!key) continue;
    if (v !== undefined && v !== null) {
      out[key] = String(v);
    }
  }
  return out;
}

function normalizeTiddler(raw, existing = null, touchModified = true) {
  const title = String(raw && raw.title != null ? raw.title : '').trim();
  if (!title) {
    throw new Error('Tiddler title cannot be empty.');
  }
  const now = twTimestamp();
  const hasTags = raw && Array.isArray(raw.tags);
  const rawTags = hasTags ? raw.tags : (existing ? existing.tags : []);
  const tags = [];
  const tagSeen = new Set();
  for (const item of rawTags) {
    const clean = String(item == null ? '' : item).trim();
    if (clean && !tagSeen.has(clean)) {
      tagSeen.add(clean);
      tags.push(clean);
    }
  }
  const fields = raw && raw.fields !== undefined
    ? normalizeFields(raw.fields)
    : (existing ? { ...existing.fields } : {});
  const attachments = raw && raw.attachments !== undefined
    ? normalizeAttachments(raw.attachments)
    : (existing && Array.isArray(existing.attachments) ? deepClone(existing.attachments) : []);

  return {
    title,
    text: raw && raw.text !== undefined ? String(raw.text) : (existing ? existing.text : ''),
    tags,
    type: String((raw && raw.type) || (existing && existing.type) || 'text/vnd.tidly'),
    created: String((raw && raw.created) || (existing && existing.created) || now),
    modified: touchModified
      ? now
      : String((raw && raw.modified) || (existing && existing.modified) || now),
    fields,
    attachments
  };
}

export class TiddlerStore {
  constructor({ tiddlers = [], shadows = [] } = {}) {
    this._user = new Map();
    this._shadows = new Map();
    this._undo = [];
    this._redo = [];
    this._listeners = new Set();
    this._dirty = false;

    for (const s of shadows) {
      if (s && s.title) {
        const norm = normalizeTiddler(s, null, false);
        this._shadows.set(norm.title, norm);
      }
    }
    this.loadUserTiddlers(tiddlers, { markDirty: false });
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _emit(event) {
    for (const fn of this._listeners) {
      fn(event);
    }
  }

  isDirty() {
    return this._dirty;
  }

  markClean() {
    this._dirty = false;
    this._emit({ type: 'clean', titles: [] });
  }

  get(title) {
    const key = String(title || '');
    const tiddler = this._user.get(key) || this._shadows.get(key) || null;
    return tiddler ? deepClone(tiddler) : null;
  }

  has(title) {
    const key = String(title || '');
    return this._user.has(key) || this._shadows.has(key);
  }

  hasUser(title) {
    return this._user.has(String(title || ''));
  }

  isShadow(title) {
    return this._shadows.has(String(title || ''));
  }

  isOverriddenShadow(title) {
    const key = String(title || '');
    return this._shadows.has(key) && this._user.has(key);
  }

  getText(title, fallback = '') {
    const t = this._user.get(title) || this._shadows.get(title);
    return t ? t.text : fallback;
  }

  getAll({ includeSystem = false, includeShadows = false } = {}) {
    const map = new Map();
    if (includeShadows) {
      for (const [k, v] of this._shadows.entries()) {
        if (includeSystem || !k.startsWith('$:/')) {
          map.set(k, deepClone(v));
        }
      }
    }
    for (const [k, v] of this._user.entries()) {
      if (includeSystem || !k.startsWith('$:/')) {
        map.set(k, deepClone(v));
      }
    }
    return Array.from(map.values());
  }

  getUserTiddlers() {
    return Array.from(this._user.values(), (v) => deepClone(v));
  }

  _pushUndo(changes) {
    if (!changes.length) return;
    this._undo.push(changes);
    if (this._undo.length > MAX_UNDO_STEPS) {
      this._undo.shift();
    }
    this._redo = [];
  }

  put(rawTiddler, { recordUndo = true, touchModified = true } = {}) {
    const key = String(rawTiddler && rawTiddler.title != null ? rawTiddler.title : '').trim();
    const existingUser = this._user.get(key) || null;
    const existingAny = existingUser || this._shadows.get(key) || null;
    const next = normalizeTiddler(rawTiddler, existingAny, touchModified);

    if (recordUndo) {
      this._pushUndo([{ title: next.title, before: existingUser ? deepClone(existingUser) : null, after: deepClone(next) }]);
    }
    this._user.set(next.title, next);
    this._dirty = true;
    this._emit({ type: 'put', titles: [next.title] });
    return deepClone(next);
  }

  delete(title, { recordUndo = true } = {}) {
    const key = String(title || '');
    const existing = this._user.get(key);
    if (!existing) return null;
    const snapshot = deepClone(existing);
    if (recordUndo) {
      this._pushUndo([{ title: key, before: snapshot, after: null }]);
    }
    this._user.delete(key);
    this._dirty = true;
    this._emit({ type: 'delete', titles: [key] });
    return snapshot;
  }

  rename(oldTitle, newTitle, { updateLinks = true, recordUndo = true } = {}) {
    const oldKey = String(oldTitle || '').trim();
    const newKey = String(newTitle || '').trim();
    if (!newKey) {
      throw new Error('New title cannot be empty.');
    }
    if (oldKey === newKey) {
      return this.get(oldKey);
    }
    if (this._user.has(newKey) || this._shadows.has(newKey)) {
      throw new Error('Target title already exists: ' + newKey);
    }
    const existing = this._user.get(oldKey) || this._shadows.get(oldKey);
    if (!existing) {
      throw new Error('Source tiddler not found: ' + oldKey);
    }

    const changes = [];
    const oldUser = this._user.get(oldKey) || null;
    const moved = normalizeTiddler({ ...deepClone(existing), title: newKey }, null, true);

    if (oldUser) {
      changes.push({ title: oldKey, before: deepClone(oldUser), after: null });
      this._user.delete(oldKey);
    }
    changes.push({ title: newKey, before: null, after: deepClone(moved) });
    this._user.set(newKey, moved);

    const touched = [oldKey, newKey];
    if (updateLinks) {
      for (const [k, item] of Array.from(this._user.entries())) {
        const nextText = rewriteLinksInText(item.text, oldKey, newKey);
        const tagChanged = item.tags.includes(oldKey);
        if (nextText !== item.text || tagChanged) {
          const before = deepClone(item);
          const nextTags = tagChanged
            ? Array.from(new Set(item.tags.map((tg) => (tg === oldKey ? newKey : tg))))
            : [...item.tags];
          const updated = { ...deepClone(item), text: nextText, tags: nextTags, modified: twTimestamp() };
          this._user.set(k, updated);
          changes.push({ title: k, before, after: deepClone(updated) });
          touched.push(k);
        }
      }
    }

    if (recordUndo) {
      this._pushUndo(changes);
    }
    this._dirty = true;
    this._emit({ type: 'rename', titles: touched, oldTitle: oldKey, newTitle: newKey });
    return deepClone(moved);
  }

  setField(title, fieldName, value) {
    const key = String(title || '');
    const field = String(fieldName || '').trim();
    if (!field) return null;
    const current = this.get(key);
    if (!current) return null;
    const nextFields = { ...current.fields };
    if (value === null || value === undefined || value === '') {
      delete nextFields[field];
    } else {
      nextFields[field] = String(value);
    }
    return this.put({ ...current, fields: nextFields });
  }

  getLinksFrom(title) {
    const item = this._user.get(title) || this._shadows.get(title);
    if (!item) return [];
    return extractLinksFromText(item.text);
  }

  getBacklinks(title) {
    const target = String(title || '');
    if (!target) return [];
    const results = [];
    for (const [k, item] of this._user.entries()) {
      if (k === target || k.startsWith('$:/')) continue;
      if (extractLinksFromText(item.text).includes(target)) {
        results.push(k);
      }
    }
    return results.sort(trCompare);
  }

  getAllTags({ includeSystem = false } = {}) {
    const counts = new Map();
    for (const item of this.getAll({ includeSystem, includeShadows: false })) {
      for (const tag of item.tags) {
        if (!includeSystem && tag.startsWith('$:/')) continue;
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => trCompare(a.tag, b.tag));
  }

  canUndo() {
    return this._undo.length > 0;
  }

  canRedo() {
    return this._redo.length > 0;
  }

  undo() {
    const entry = this._undo.pop();
    if (!entry) return false;
    const titles = [];
    for (let i = entry.length - 1; i >= 0; i--) {
      const ch = entry[i];
      if (ch.before) {
        this._user.set(ch.title, deepClone(ch.before));
      } else {
        this._user.delete(ch.title);
      }
      titles.push(ch.title);
    }
    this._redo.push(entry);
    this._dirty = true;
    this._emit({ type: 'undo', titles });
    return true;
  }

  redo() {
    const entry = this._redo.pop();
    if (!entry) return false;
    const titles = [];
    for (const ch of entry) {
      if (ch.after) {
        this._user.set(ch.title, deepClone(ch.after));
      } else {
        this._user.delete(ch.title);
      }
      titles.push(ch.title);
    }
    this._undo.push(entry);
    this._dirty = true;
    this._emit({ type: 'redo', titles });
    return true;
  }

  loadUserTiddlers(tiddlers, { markDirty = false } = {}) {
    this._user.clear();
    this._undo = [];
    this._redo = [];
    if (Array.isArray(tiddlers)) {
      for (const item of tiddlers) {
        if (item && String(item.title || '').trim()) {
          const norm = normalizeTiddler(item, null, false);
          this._user.set(norm.title, norm);
        }
      }
    }
    this._dirty = Boolean(markDirty);
    this._emit({ type: 'load', titles: Array.from(this._user.keys()) });
  }
}
