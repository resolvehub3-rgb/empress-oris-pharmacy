/**
 * Lightweight IndexedDB wrapper for offline POS data.
 * No external dependencies.
 */
const DB_NAME = "empress-oris-offline";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("products")) {
        const ps = db.createObjectStore("products", { keyPath: "id" });
        ps.createIndex("barcode", "barcode", { unique: false });
        ps.createIndex("name", "name", { unique: false });
      }
      if (!db.objectStoreNames.contains("pendingSales")) {
        db.createObjectStore("pendingSales", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("syncMeta")) {
        db.createObjectStore("syncMeta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function idbPut(store: string, value: any): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    const r = os.put(value);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

export async function idbGetAll<T = any>(store: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const os = tx.objectStore(store);
    const r = os.getAll();
    r.onsuccess = () => resolve(r.result as T[]);
    r.onerror = () => reject(r.error);
  });
}

export async function idbGet<T = any>(store: string, key: any): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const os = tx.objectStore(store);
    const r = os.get(key);
    r.onsuccess = () => resolve(r.result as T | undefined);
    r.onerror = () => reject(r.error);
  });
}

export async function idbDelete(store: string, key: any): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    const r = os.delete(key);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

export async function idbClear(store: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    const r = os.clear();
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

export async function cacheProducts(products: any[]): Promise<void> {
  await idbClear("products");
  for (const p of products) await idbPut("products", p);
  await idbPut("syncMeta", { key: "lastProductSync", value: new Date().toISOString() });
}

export async function getCachedProducts(): Promise<any[]> {
  return idbGetAll("products");
}

export async function queuePendingSale(sale: any): Promise<void> {
  await idbPut("pendingSales", sale);
}

export async function getPendingSales(): Promise<any[]> {
  return idbGetAll("pendingSales");
}

export async function removePendingSale(id: string): Promise<void> {
  await idbDelete("pendingSales", id);
}

export async function getLastSync(): Promise<string | null> {
  const m = await idbGet<{ key: string; value: string }>("syncMeta", "lastSync");
  return m?.value || null;
}

export async function setLastSync(value: string): Promise<void> {
  await idbPut("syncMeta", { key: "lastSync", value });
}
