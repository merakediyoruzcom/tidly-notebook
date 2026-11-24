const SVG_PATHS = {
  search: '<circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.2" y2="16.2"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4"/><path d="M8 20v-6h8v6"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><line x1="8.2" y1="10.9" x2="15.7" y2="6.1"/><line x1="8.2" y1="13.1" x2="15.7" y2="17.9"/>',
  menu: '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>',
  close: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/>',
  fold: '<line x1="5" y1="6" x2="19" y2="6"/><polyline points="8 15 12 11 16 15"/>',
  unfold: '<line x1="5" y1="18" x2="19" y2="18"/><polyline points="8 9 12 13 16 9"/>',
  up: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="6 11 12 5 18 11"/>',
  down: '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="6 13 12 19 18 13"/>',
  info: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="8" r="0.8" fill="currentColor"/>',
  graph: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="12" cy="18" r="2.5"/><line x1="8.2" y1="7" x2="15.6" y2="7"/><line x1="7.3" y1="8.1" x2="10.8" y2="15.8"/><line x1="16.8" y1="9.2" x2="13.1" y2="15.8"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.6"/>',
  tag: '<path d="M20 13l-7 7-9-9V4h7l9 9z"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/>',
  filter: '<polygon points="4 5 20 5 14 12 14 19 10 17 10 12 4 5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2m0 14v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M3 12h2m14 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4"/>',
  upload: '<path d="M12 16V4"/><polyline points="7 9 12 4 17 9"/><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/>',
  download: '<path d="M12 4v12"/><polyline points="7 11 12 16 17 11"/><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a5 5 0 0 0 0 10h3"/>',
  book: '<path d="M4 5h6a3 3 0 0 1 3 3v11a2 2 0 0 0-2-2H4z"/><path d="M20 5h-6a3 3 0 0 0-3 3v11a2 2 0 0 1 2-2h7z"/>',
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="15" y1="4" x2="15" y2="20"/>',
  layers: '<polygon points="12 3 3 8 12 13 21 8 12 3"/><polyline points="3 13 12 18 21 13"/><polyline points="3 17 12 22 21 17"/>',
  paperclip: '<path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="10" y1="4" x2="10" y2="20"/>'
};

export function icon(name, size = 18) {
  const body = SVG_PATHS[name] || SVG_PATHS.book;
  return (
    '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    body + '</svg>'
  );
}
