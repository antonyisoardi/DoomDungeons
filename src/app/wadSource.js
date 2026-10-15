// Finding a WAD: next to the game (local play), remembered in IndexedDB, or
// chosen/dropped by the player. WADs never leave the player's machine.

const CANDIDATES = ['wads/DOOM.WAD', 'wads/doom.wad', 'wads/DOOM1.WAD', 'wads/doom1.wad'];
const DB_NAME = 'doomdungeons';
const STORE = 'wads';
const KEY = 'current';

export async function fetchBundledWad() {
  for (const url of CANDIDATES) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > 12) return { buffer, name: url.split('/').pop() };
    } catch {
      // Not served (e.g. on GitHub Pages): fall through to the next source.
    }
  }
  return null;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadStoredWad() {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('DoomDungeons: could not read saved WAD', err);
    return null;
  }
}

export async function storeWad(record) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record, KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('DoomDungeons: could not remember WAD', err);
  }
}

export async function forgetWad() {
  try {
    const db = await openDb();
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(KEY);
  } catch (err) {
    console.warn('DoomDungeons: could not forget WAD', err);
  }
}

export async function readFile(file) {
  return { buffer: await file.arrayBuffer(), name: file.name };
}
