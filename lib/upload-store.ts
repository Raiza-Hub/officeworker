const DB_NAME = "officeworker-uploads";
const DB_VERSION = 1;
const STORE_NAME = "uploads";

export type StoredUploadPart = { number: number; size: number };

export type StoredUpload = {
  id: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  storageKey: string | null;
  uploadId: string | null;
  partSize: number | null;
  doneParts: number[];
  createdAt: number;
};

let dbPromise: Promise<IDBDatabase | null> | null = null;
let persistRequested = false;

function canUseIndexedDB(): boolean {
  return typeof indexedDB !== "undefined";
}

async function requestPersistOnce() {
  if (persistRequested) return;
  persistRequested = true;
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      await navigator.storage.persist();
    }
  } catch {
    // best effort
  }
}

function openDb(): Promise<IDBDatabase | null> {
  if (!canUseIndexedDB()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  void requestPersistOnce();
  return dbPromise;
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDb().then((db) => {
    if (!db) return null;
    return new Promise<T | null>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = run(store);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => resolve(null);
        tx.onabort = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  });
}

export async function saveUpload(entry: StoredUpload): Promise<void> {
  await withStore("readwrite", (store) => store.put(entry));
}

export async function updateUpload(id: string, patch: Partial<StoredUpload>): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result as StoredUpload | undefined;
        if (existing) {
          store.put({ ...existing, ...patch });
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getUpload(id: string): Promise<StoredUpload | null> {
  return withStore("readonly", (store) => store.get(id));
}

export async function findUploadByStorageKey(storageKey: string): Promise<StoredUpload | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise<StoredUpload | null>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result as IDBCursorWithValue | null;
        if (!cursor) {
          resolve(null);
          return;
        }
        const value = cursor.value as StoredUpload;
        if (value.storageKey === storageKey) {
          resolve(value);
          return;
        }
        cursor.continue();
      };
      request.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function deleteUpload(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}

export async function listUploads(): Promise<StoredUpload[]> {
  const result = await withStore("readonly", (store) => store.getAll());
  return (result as StoredUpload[] | null) ?? [];
}
