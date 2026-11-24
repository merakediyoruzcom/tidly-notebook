const DB_NAME = 'tidly-notebook-backups';
const STORE_NAME = 'snapshots';
const DB_VERSION = 1;
const LS_PREFIX = 'tidly-backup:';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

export async function saveBackup(wikiId, data) {
  const key = String(wikiId || 'default');
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(data, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LS_PREFIX + key, JSON.stringify(data));
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }
}

export async function loadBackup(wikiId) {
  const key = String(wikiId || 'default');
  try {
    const db = await openDb();
    const res = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (res) return res;
  } catch {
    // Fallback to localStorage below
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LS_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function clearBackup(wikiId) {
  const key = String(wikiId || 'default');
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore IndexedDB errors on clear
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LS_PREFIX + key);
    }
  } catch {
    // Ignore localStorage errors
  }
}

export function downloadTextFile(content, filename, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    if (a.parentNode) a.parentNode.removeChild(a);
  }, 1500);
}

export async function saveHtmlToDisk(html, filename = 'tidly-notebook.html', cachedHandle = null) {
  let handle = cachedHandle;
  if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
    try {
      if (!handle) {
        handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'HTML Wiki', accept: { 'text/html': ['.html', '.htm'] } }]
        });
      }
      const writable = await handle.createWritable();
      await writable.write(html);
      await writable.close();
      return { method: 'fsa', handle };
    } catch (err) {
      if (err && err.name === 'AbortError') {
        throw err;
      }
      handle = null;
    }
  }
  downloadTextFile(html, filename, 'text/html;charset=utf-8');
  return { method: 'download', handle: null };
}

export async function shareHtmlMobile(html, filename = 'tidly-notebook.html') {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof File === 'function') {
    try {
      const file = new File([html], filename, { type: 'text/html' });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return 'shared';
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return 'shared';
    }
  }
  downloadTextFile(html, filename, 'text/html;charset=utf-8');
  return 'download';
}
