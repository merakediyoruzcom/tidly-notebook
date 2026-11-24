import { runFilter } from '../core/filter.js';

const VALID_PALETTES = new Set(['paper', 'night', 'sepia', 'forest', 'classroom', 'clinic']);
const VALID_FONTS = new Set(['editorial', 'sans', 'mono']);
const VALID_LAYOUTS = new Set(['river', 'focus', 'split']);
const ALLOWED_COLOR_KEYS = new Set(['bg', 'surface', 'ink', 'accent']);

export function getWikiLang(store) {
  const raw = store.getText('$:/Language', 'tr').trim().toLowerCase();
  return raw === 'en' ? 'en' : 'tr';
}

export function applyThemeFromStore(store) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  const palette = store.getText('$:/Palette', 'paper').trim();
  root.setAttribute('data-palette', VALID_PALETTES.has(palette) ? palette : 'paper');

  const font = store.getText('$:/Font', 'editorial').trim();
  root.setAttribute('data-font', VALID_FONTS.has(font) ? font : 'editorial');

  const layout = store.getText('$:/Layout', 'river').trim();
  root.setAttribute('data-layout', VALID_LAYOUTS.has(layout) ? layout : 'river');

  const sizeNum = Math.min(22, Math.max(13, parseInt(store.getText('$:/FontSize', '16'), 10) || 16));
  root.style.setProperty('--font-size-base', sizeNum + 'px');

  const lang = getWikiLang(store);
  root.setAttribute('lang', lang);

  const siteTitle = store.getText('$:/SiteTitle', 'Tidly Notebook').trim() || 'Tidly Notebook';
  document.title = siteTitle;

  // Apply custom palette overrides safely
  for (const key of ALLOWED_COLOR_KEYS) {
    root.style.removeProperty('--' + key);
  }
  root.style.removeProperty('--surface-2');
  root.style.removeProperty('--accent-soft');
  try {
    const rawColors = store.getText('$:/CustomColors', '{}');
    const custom = JSON.parse(rawColors);
    if (custom && typeof custom === 'object') {
      for (const [k, v] of Object.entries(custom)) {
        if (ALLOWED_COLOR_KEYS.has(k) && /^#[0-9a-fA-F]{6}$/.test(String(v))) {
          root.style.setProperty('--' + k, String(v));
        }
      }
      if (custom.accent && /^#[0-9a-fA-F]{6}$/.test(custom.accent)) {
        root.style.setProperty('--accent-soft', 'color-mix(in srgb, ' + custom.accent + ' 14%, transparent)');
      }
      if (custom.surface && /^#[0-9a-fA-F]{6}$/.test(custom.surface)) {
        root.style.setProperty('--surface-2', 'color-mix(in srgb, ' + custom.surface + ' 92%, var(--ink) 8%)');
      }
    }
  } catch {
    // Ignore malformed custom color JSON
  }

  // Apply user CSS cards tagged $:/tags/Stylesheet
  let styleEl = document.getElementById('tidly-user-styles');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'tidly-user-styles';
    styleEl.setAttribute('data-runtime', 'true');
    document.head.appendChild(styleEl);
  }
  const userCssTitles = [
    ...runFilter('[all[tiddlers]tag[$:/tags/Stylesheet]sort[title]]', store).titles,
    ...runFilter('[all[system]tag[$:/tags/Stylesheet]sort[title]]', store).titles
  ];
  const uniqueTitles = Array.from(new Set(userCssTitles));
  const combinedCss = uniqueTitles
    .map((title) => '/* ' + title + ' */\n' + store.getText(title))
    .join('\n\n')
    .replace(/<\/style/gi, '');
  styleEl.textContent = combinedCss;
}
