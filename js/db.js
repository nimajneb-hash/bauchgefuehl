// Winzige IndexedDB-Hülle. Alles bleibt auf dem Gerät.
const DB_NAME = 'bauchgefuehl';
const VERSION = 1;
const STORES = ['meals', 'symptoms', 'dict', 'kv'];

let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: s === 'kv' ? 'k' : 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const db = {
  all: (store) => tx(store, 'readonly', (s) => reqP(s.getAll())),
  put: (store, obj) => tx(store, 'readwrite', (s) => reqP(s.put(obj))),
  del: (store, id) => tx(store, 'readwrite', (s) => reqP(s.delete(id))),
  clear: (store) => tx(store, 'readwrite', (s) => reqP(s.clear())),
  async get(k, fallback) {
    const r = await tx('kv', 'readonly', (s) => reqP(s.get(k)));
    return r ? r.v : fallback;
  },
  set: (k, v) => tx('kv', 'readwrite', (s) => reqP(s.put({ k, v }))),
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
