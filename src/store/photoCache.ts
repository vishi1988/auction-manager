// Player photos, team logos and sponsor logos live in IndexedDB, not in
// localStorage: localStorage holds only about 5 MB per site, which a hundred
// sharp photos would fill. IndexedDB has room for hundreds of MB.
//
// Everything is read into memory once when the app starts (main.tsx waits for
// it), so the rest of the app can keep loading auctions synchronously.
import { diffPhotos, type PhotoMap } from './photos';

const DB_NAME = 'khiladi-photos';
const STORE = 'photos';
/** Records are keyed "<auctionId>/<photoId>", e.g. "a_abc/player-p_xyz". */
const SEP = '/';

const cache = new Map<string, PhotoMap>();
let db: IDBDatabase | null = null;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  });
}

function readAll(d: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) return resolve();
      const key = String(cur.key);
      const cut = key.indexOf(SEP);
      if (cut > 0 && typeof cur.value === 'string') {
        const id = key.slice(0, cut);
        const map = cache.get(id) ?? {};
        map[key.slice(cut + 1)] = cur.value;
        cache.set(id, map);
      }
      cur.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

async function start(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const d = await open();
    await readAll(d);
    db = d;
  } catch (err) {
    // Private windows and some embedded browsers refuse IndexedDB: photos then stay in localStorage as before.
    console.warn('Photo storage unavailable', err);
    cache.clear();
  }
}

/** Resolves once photos are in memory (or IndexedDB turned out to be unavailable). Never rejects. */
export const photoCacheReady: Promise<void> = Promise.race([
  start(),
  new Promise<void>((resolve) => setTimeout(resolve, 8000)),
]);

/** True when photos are kept in IndexedDB; false means they stay inside the auction in localStorage. */
export function photoStorageOn(): boolean {
  return db !== null;
}

export function photosFor(id: string): PhotoMap | undefined {
  return cache.get(id);
}

function write(fn: (store: IDBObjectStore) => void) {
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    fn(tx.objectStore(STORE));
    tx.onerror = () => {
      console.warn('Could not save photos', tx.error);
      alert('Could not save the photos: this device is out of storage space. Free some space or remove old auctions.');
    };
  } catch (err) {
    console.warn('Could not save photos', err);
  }
}

/** Saves the photos of auction `id`, writing only the ones that changed. */
export function storePhotos(id: string, photos: PhotoMap) {
  const { put, remove } = diffPhotos(cache.get(id) ?? {}, photos);
  cache.set(id, photos);
  if (!Object.keys(put).length && !remove.length) return;
  write((s) => {
    for (const [k, v] of Object.entries(put)) s.put(v, id + SEP + k);
    for (const k of remove) s.delete(id + SEP + k);
  });
}

/** Another tab saved these photos already; only bring this tab's memory up to date. */
export function rememberPhotos(id: string, photos: PhotoMap) {
  cache.set(id, photos);
}

export function dropPhotos(id: string) {
  cache.delete(id);
  write((s) => s.delete(IDBKeyRange.bound(id + SEP, id + SEP + '￿')));
}
