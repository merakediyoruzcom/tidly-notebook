import { twTimestamp } from './utils.js';

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);

const BLOCKED_EXTENSIONS = new Set([
  'html', 'htm', 'xhtml', 'svg', 'svgz', 'js', 'mjs', 'cjs',
  'exe', 'bat', 'cmd', 'ps1', 'vbs', 'sh', 'php', 'asp', 'aspx', 'jsp'
]);

const SAFE_FALLBACK_EXTENSIONS = new Set([
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp',
  'txt', 'csv', 'md', 'markdown', 'json',
  'mp3', 'wav', 'ogg',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'
]);

function getExtension(filename) {
  const clean = String(filename || '').trim().toLowerCase();
  const dot = clean.lastIndexOf('.');
  return dot > 0 ? clean.slice(dot + 1) : '';
}

export function isAllowedAttachmentMime(mime, filename = '') {
  const ext = getExtension(filename);
  if (ext && BLOCKED_EXTENSIONS.has(ext)) return false;

  const cleanMime = String(mime || '').split(';')[0].trim().toLowerCase();
  if (
    cleanMime.includes('html') ||
    cleanMime.includes('svg') ||
    cleanMime.includes('javascript') ||
    cleanMime.includes('ecmascript')
  ) {
    return false;
  }

  if (ALLOWED_ATTACHMENT_MIMES.has(cleanMime)) return true;
  if ((!cleanMime || cleanMime === 'application/octet-stream') && ext && SAFE_FALLBACK_EXTENSIONS.has(ext)) {
    return true;
  }
  return false;
}

export function validateAttachment({ id = '', name = '', mime = '', size = 0, dataUrl = '', addedAt = '' } = {}) {
  const cleanName = String(name || 'dosya').trim() || 'dosya';
  const cleanMime = String(mime || '').split(';')[0].trim().toLowerCase() || 'application/octet-stream';
  if (!isAllowedAttachmentMime(cleanMime, cleanName)) {
    return { ok: false, error: 'Bu dosya türü güvenlik nedeniyle desteklenmiyor: ' + cleanName };
  }

  const cleanUrl = String(dataUrl || '').trim();
  const dataMatch = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/i.exec(cleanUrl);
  if (!dataMatch) {
    return { ok: false, error: 'Geçersiz dosya verisi (base64 data URI bekleniyor).' };
  }
  if (!isAllowedAttachmentMime(dataMatch[1], cleanName)) {
    return { ok: false, error: 'Dosya içeriği MIME türü engellendi.' };
  }

  const numSize = Number(size) || Math.floor((dataMatch[2].length * 3) / 4);
  if (numSize > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: 'Dosya boyutu 5 MB sınırını aşıyor: ' + cleanName };
  }

  return {
    ok: true,
    attachment: {
      id: String(id || ('att-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6))),
      name: cleanName,
      mime: cleanMime === 'application/octet-stream' ? dataMatch[1].toLowerCase() : cleanMime,
      size: numSize,
      dataUrl: cleanUrl,
      addedAt: String(addedAt || twTimestamp())
    }
  };
}

export function normalizeAttachments(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const res = validateAttachment(item);
    if (res.ok && res.attachment) {
      out.push(res.attachment);
    }
  }
  return out;
}

export function formatBytes(bytes) {
  const n = Math.max(0, Number(bytes) || 0);
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

function detectCsvDelimiter(firstLine) {
  let inQuotes = false;
  let semi = 0;
  let comma = 0;
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (ch === ';') semi++;
      else if (ch === ',') comma++;
    }
  }
  return semi >= comma && semi > 0 ? ';' : ',';
}

function parseCsvRows(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

export function csvToMarkdownTable(csvText) {
  const clean = String(csvText == null ? '' : csvText).replace(/^\uFEFF/, '').trim();
  if (!clean) return '';
  const firstBreak = clean.search(/\r?\n/);
  const firstLine = firstBreak >= 0 ? clean.slice(0, firstBreak) : clean;
  const delimiter = detectCsvDelimiter(firstLine);
  const rows = parseCsvRows(clean, delimiter);
  if (!rows.length) return '';

  const colCount = Math.max(...rows.map((r) => r.length));
  const sanitizeCell = (v) => String(v == null ? '' : v).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();

  const headerCells = [];
  for (let c = 0; c < colCount; c++) {
    headerCells.push(sanitizeCell(rows[0][c]) || ('Sütun ' + (c + 1)));
  }

  const lines = [
    '| ' + headerCells.join(' | ') + ' |',
    '| ' + headerCells.map(() => '---').join(' | ') + ' |'
  ];

  for (let r = 1; r < rows.length; r++) {
    const rowCells = [];
    for (let c = 0; c < colCount; c++) {
      rowCells.push(sanitizeCell(rows[r][c]));
    }
    lines.push('| ' + rowCells.join(' | ') + ' |');
  }

  return lines.join('\n');
}

function splitMdRow(line) {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map((c) => c.trim().replace(/\\\|/g, '|'));
}

export function markdownTableToCsv(markdownText, delimiter = ';') {
  const lines = String(markdownText || '').split(/\r?\n/);
  for (let i = 0; i + 1 < lines.length; i++) {
    if (
      lines[i].includes('|') &&
      /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*(?::?-+:?\s*\|?)?\s*$/.test(lines[i + 1])
    ) {
      const tableRows = [splitMdRow(lines[i])];
      let j = i + 2;
      while (j < lines.length && lines[j].includes('|') && !/^\s*$/.test(lines[j])) {
        tableRows.push(splitMdRow(lines[j]));
        j++;
      }
      const csvLines = tableRows.map((r) =>
        r.map((cell) => {
          const s = String(cell || '');
          if (s.includes(delimiter) || s.includes('"') || s.includes('\n')) {
            return '"' + s.replace(/"/g, '""') + '"';
          }
          return s;
        }).join(delimiter)
      );
      return '\uFEFF' + csvLines.join('\r\n');
    }
  }
  return '\uFEFF';
}
