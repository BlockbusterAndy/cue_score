// Tiny key-value store: IndexedDB first, localStorage when IndexedDB is unavailable
// (private mode on some browsers, old WebViews).

const DB_NAME = 'cue-score';
const STORE = 'kv';
const LS_PREFIX = 'cue-score:';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  if (db) {
    try {
      return (await tx(db, 'readonly', (s) => s.get(key))) as T | undefined;
    } catch {
      /* fall through */
    }
  }
  const raw = localStorage.getItem(LS_PREFIX + key);
  return raw == null ? undefined : (JSON.parse(raw) as T);
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  if (db) {
    try {
      await tx(db, 'readwrite', (s) => s.put(value, key));
      return;
    } catch {
      /* fall through */
    }
  }
  localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
}

export async function kvDel(key: string): Promise<void> {
  const db = await openDb();
  if (db) {
    try {
      await tx(db, 'readwrite', (s) => s.delete(key));
    } catch {
      /* ignore */
    }
  }
  localStorage.removeItem(LS_PREFIX + key);
}

/** All values whose key starts with prefix. */
export async function kvList<T>(prefix: string): Promise<T[]> {
  const db = await openDb();
  if (db) {
    try {
      const range = IDBKeyRange.bound(prefix, prefix + '￿');
      return (await tx(db, 'readonly', (s) => s.getAll(range))) as T[];
    } catch {
      /* fall through */
    }
  }
  const out: T[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(LS_PREFIX + prefix)) out.push(JSON.parse(localStorage.getItem(k)!) as T);
  }
  return out;
}
