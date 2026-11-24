export function trLower(str) {
  return String(str == null ? '' : str).toLocaleLowerCase('tr');
}

export function trCompare(a, b) {
  return String(a == null ? '' : a).localeCompare(
    String(b == null ? '' : b),
    'tr',
    { sensitivity: 'base', numeric: true }
  );
}

export function twTimestamp(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const p = (n, len = 2) => String(n).padStart(len, '0');
  return (
    String(d.getUTCFullYear()).padStart(4, '0') +
    p(d.getUTCMonth() + 1) +
    p(d.getUTCDate()) +
    p(d.getUTCHours()) +
    p(d.getUTCMinutes()) +
    p(d.getUTCSeconds()) +
    p(d.getUTCMilliseconds(), 3)
  );
}

export function parseTwTimestamp(ts) {
  const s = String(ts || '').trim();
  if (/^\d{14,17}$/.test(s)) {
    const year = Number(s.slice(0, 4));
    const month = Number(s.slice(4, 6)) - 1;
    const day = Number(s.slice(6, 8));
    const hour = Number(s.slice(8, 10));
    const min = Number(s.slice(10, 12));
    const sec = Number(s.slice(12, 14));
    const ms = s.length >= 17 ? Number(s.slice(14, 17)) : 0;
    return new Date(Date.UTC(year, month, day, hour, min, sec, ms));
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(ts, lang = 'tr') {
  const d = parseTwTimestamp(ts);
  if (!d) return String(ts || '');
  const locale = lang === 'en' ? 'en-US' : 'tr-TR';
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
}

export function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isSafeUrl(url, allowImageData = false) {
  const raw = String(url == null ? '' : url).trim();
  if (!raw) return false;
  if (raw.startsWith('#')) return true;
  // Strip ASCII whitespace and control characters to block obfuscated schemes like "java\tscript:"
  const normalized = raw.replace(/[\u0000-\u0020]+/g, '');
  if (/^https?:/i.test(normalized)) return true;
  if (/^mailto:/i.test(normalized)) return true;
  if (allowImageData && /^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$/i.test(normalized)) {
    return true;
  }
  return false;
}

export function parseTagString(str) {
  const input = String(str == null ? '' : str).trim();
  if (!input) return [];
  const tags = [];
  const seen = new Set();
  const re = /\[\[([^\]]+)\]\]|(\S+)/g;
  let match;
  while ((match = re.exec(input)) !== null) {
    const tag = (match[1] !== undefined ? match[1] : match[2]).trim();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags;
}

export function formatTagString(tags) {
  if (!Array.isArray(tags)) return '';
  return tags
    .map((t) => String(t).trim())
    .filter(Boolean)
    .map((t) => (/\s/.test(t) ? '[[' + t + ']]' : t))
    .join(' ');
}

export function generateWikiId() {
  const rand = typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function'
    ? Array.from(globalThis.crypto.getRandomValues(new Uint8Array(6)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    : Math.random().toString(36).slice(2, 10);
  return 'tidly-' + Date.now().toString(36) + '-' + rand;
}

export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => deepClone(item));
  const out = {};
  for (const key of Object.keys(obj)) {
    out[key] = deepClone(obj[key]);
  }
  return out;
}

export function debounce(fn, ms = 300) {
  let timer = null;
  let lastArgs = null;
  const wrapped = (...args) => {
    lastArgs = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const a = lastArgs;
      lastArgs = null;
      fn(...a);
    }, ms);
  };
  wrapped.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
      lastArgs = null;
    }
  };
  wrapped.flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
      const a = lastArgs || [];
      lastArgs = null;
      fn(...a);
    }
  };
  return wrapped;
}
