import { escapeHtml } from '../core/utils.js';

export function escapeJsonForScript(jsonStr) {
  return String(jsonStr)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function serializeSingleHtml({ title = 'Tidly Notebook', lang = 'tr', palette = 'paper', coreCss = '', coreJs = '', storeData = {} }) {
  const safeTitle = escapeHtml(title || 'Tidly Notebook');
  const safeLang = lang === 'en' ? 'en' : 'tr';
  const safePalette = escapeHtml(palette || 'paper');
  const safeJson = escapeJsonForScript(JSON.stringify(storeData));
  const scriptClose = '<' + '/script>';

  return [
    '<!DOCTYPE html>',
    '<html lang="' + safeLang + '" data-palette="' + safePalette + '" data-font="editorial" data-layout="river">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '  <title>' + safeTitle + '</title>',
    '  <style id="tidly-core-css">' + coreCss + '</style>',
    '</head>',
    '<body>',
    '  <div id="app"></div>',
    '  <script id="tidly-store" type="application/json">' + safeJson + scriptClose,
    '  <script id="tidly-core-js">' + coreJs + scriptClose,
    '</body>',
    '</html>',
    ''
  ].join('\n');
}

export function extractStoreFromHtml(htmlStr) {
  const src = String(htmlStr || '');
  const openTag = '<script id="tidly-store" type="application/json">';
  const startIdx = src.indexOf(openTag);
  if (startIdx < 0) return null;
  const contentStart = startIdx + openTag.length;
  const closeTag = '<' + '/script>';
  const endIdx = src.indexOf(closeTag, contentStart);
  if (endIdx < 0) return null;
  const rawJson = src.slice(contentStart, endIdx).trim();
  if (!rawJson) return null;
  return JSON.parse(rawJson);
}

export function serializeFromDocument(doc, storeData, { title = 'Tidly Notebook', lang = 'tr', palette = 'paper' } = {}) {
  const cssEl = doc && doc.getElementById ? doc.getElementById('tidly-core-css') : null;
  const jsEl = doc && doc.getElementById ? doc.getElementById('tidly-core-js') : null;
  const coreCss = cssEl ? String(cssEl.textContent || '') : '';
  const coreJs = jsEl ? String(jsEl.textContent || '') : '';
  return serializeSingleHtml({ title, lang, palette, coreCss, coreJs, storeData });
}
