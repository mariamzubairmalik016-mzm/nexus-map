import type { OfflinePack, OfflinePlace } from "../types/offline";
import type { RoadAlert } from "../types/roadAlerts";

// A single request that failed while offline and must be replayed on reconnect.
export type QueuedRequest = {
  id: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
  label?: string;
  createdAt: string;
};

// Locally cached copies of server data so pages still render offline.
export type OfflineFavorite = { id: string; name: string; city?: string; country?: string; category?: string; imageUrl?: string; savedAt: string };
export type OfflineHistoryItem = { id: string; startName: string; destinationName: string; distanceKm?: number; durationMinutes?: number; createdAt: string };

const DB_NAME = "nexus-map-offline";
const DB_VERSION = 4;

// Single source of truth for every object store. Adding a store here + bumping
// DB_VERSION is all that's required; migration creates only what's missing.
type StoreSpec = { keyPath: string; indexes?: { name: string; keyPath: string }[] };
const STORES: Record<string, StoreSpec> = {
  packs: { keyPath: "id" },
  places: { keyPath: "id", indexes: [{ name: "packId", keyPath: "packId" }] },
  favorites: { keyPath: "id" },
  history: { keyPath: "id" },
  syncQueue: { keyPath: "id" },
  roadAlerts: { keyPath: "id" },
  alertReports: { keyPath: "id" },
  notifications: { keyPath: "id" },
  savedRoutes: { keyPath: "id" },
  aiHistory: { keyPath: "id" },
};
const STORE_NAMES = Object.keys(STORES);

// Store-name constants (avoid repeating string literals).
export const STORE = {
  packs: "packs",
  places: "places",
  favorites: "favorites",
  history: "history",
  syncQueue: "syncQueue",
  roadAlerts: "roadAlerts",
  alertReports: "alertReports",
  notifications: "notifications",
  savedRoutes: "savedRoutes",
  aiHistory: "aiHistory",
} as const;

const debug = (...args: unknown[]) => {
  // Store names / schema only — never user data or secrets.
  if (import.meta.env.DEV) console.debug("[offlineDb]", ...args);
};

// Create every missing store/index without touching existing ones or data.
const createMissingStores = (db: IDBDatabase, upgradeTx: IDBTransaction | null) => {
  for (const [name, spec] of Object.entries(STORES)) {
    const store = db.objectStoreNames.contains(name)
      ? upgradeTx?.objectStore(name)
      : (() => {
          debug("created store:", name);
          return db.createObjectStore(name, { keyPath: spec.keyPath });
        })();
    if (!store) continue;
    spec.indexes?.forEach((index) => {
      if (!store.indexNames.contains(index.name)) store.createIndex(index.name, index.keyPath);
    });
  }
};

const openAt = (version?: number) =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = version ? indexedDB.open(DB_NAME, version) : indexedDB.open(DB_NAME);
    request.onupgradeneeded = () => createMissingStores(request.result, request.transaction);
    request.onblocked = () => debug("open blocked — another tab holds an older version open");
    request.onsuccess = () => {
      const db = request.result;
      // If another tab triggers a version change, close so it isn't blocked.
      db.onversionchange = () => {
        debug("versionchange — closing connection");
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });

let dbPromise: Promise<IDBDatabase> | null = null;

const missingStores = (db: IDBDatabase) => STORE_NAMES.filter((name) => !db.objectStoreNames.contains(name));

/**
 * Opens the database and guarantees every expected store exists. If another
 * app instance created the DB at the current version without a newer store,
 * this forces a one-off upgrade (version + 1) to add it — non-destructively.
 */
export const ensureDatabaseReady = async (): Promise<IDBDatabase> => {
  if (dbPromise) {
    try {
      const existing = await dbPromise;
      if (missingStores(existing).length === 0) return existing;
    } catch {
      dbPromise = null;
    }
  }

  dbPromise = (async () => {
    // Open at the CURRENT on-disk version first — never request a lower version
    // than exists (that throws VersionError). This handles a DB already bumped
    // past DB_VERSION by a previous heal or another app instance.
    let db = await openAt();
    if (db.version < DB_VERSION) {
      db.close();
      db = await openAt(DB_VERSION);
    }
    const missing = missingStores(db);
    if (missing.length > 0) {
      debug("stores missing at v" + db.version + ", forcing upgrade:", missing.join(","));
      const nextVersion = db.version + 1;
      db.close();
      db = await openAt(nextVersion);
      if (missingStores(db).length > 0) {
        throw new Error("IndexedDB schema could not be migrated.");
      }
    }
    return db;
  })();

  return dbPromise;
};

export const ensureDbReady = () =>
  ensureDatabaseReady()
    .then(() => true)
    .catch(() => false);

export const hasObjectStore = async (name: string) => {
  try {
    const db = await ensureDatabaseReady();
    return db.objectStoreNames.contains(name);
  } catch {
    return false;
  }
};

// Read helper (single request) with one self-healing retry.
const readAll = async <T>(store: string): Promise<T[]> => {
  const run = async () => {
    const db = await ensureDatabaseReady();
    return new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const request = tx.objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
      tx.onabort = () => reject(tx.error);
    });
  };
  try {
    return await run();
  } catch (error) {
    debug("read failed, resetting + retrying:", store, (error as Error)?.name);
    dbPromise = null;
    return run();
  }
};

// Write helper (whole transaction) with one self-healing retry.
const writeOp = async (store: string, fn: (s: IDBObjectStore) => void): Promise<void> => {
  const run = async () => {
    const db = await ensureDatabaseReady();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      fn(tx.objectStore(store));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };
  try {
    await run();
  } catch (error) {
    debug("write failed, resetting + retrying:", store, (error as Error)?.name);
    dbPromise = null;
    await run();
  }
};

export const offlineDb = {
  // --- Map packs / offline regions ---
  getPacks: () => readAll<OfflinePack>(STORE.packs),
  savePack: (pack: OfflinePack) => writeOp(STORE.packs, (s) => s.put(pack)),
  deletePack: (id: string) => writeOp(STORE.packs, (s) => s.delete(id)),

  // --- Offline places / search ---
  savePlaces: (items: OfflinePlace[]) => writeOp(STORE.places, (s) => items.forEach((i) => s.put(i))),
  searchPlaces: async (query: string) => {
    const items = await readAll<OfflinePlace>(STORE.places);
    const q = query.toLowerCase().trim();
    if (!q) return items.slice(0, 30);
    return items
      .filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.address?.toLowerCase().includes(q),
      )
      .slice(0, 30);
  },

  // --- Offline favorites cache ---
  getFavorites: () => readAll<OfflineFavorite>(STORE.favorites),
  saveFavorites: (items: OfflineFavorite[]) => writeOp(STORE.favorites, (s) => items.forEach((i) => s.put(i))),
  saveFavorite: (item: OfflineFavorite) => writeOp(STORE.favorites, (s) => s.put(item)),
  deleteFavorite: (id: string) => writeOp(STORE.favorites, (s) => s.delete(id)),

  // --- Offline trip/route history cache ---
  getHistory: () => readAll<OfflineHistoryItem>(STORE.history),
  saveHistory: (items: OfflineHistoryItem[]) => writeOp(STORE.history, (s) => items.forEach((i) => s.put(i))),
  addHistory: (item: OfflineHistoryItem) => writeOp(STORE.history, (s) => s.put(item)),
  deleteHistory: (id: string) => writeOp(STORE.history, (s) => s.delete(id)),

  // --- Offline write queue (background sync) ---
  enqueue: (item: QueuedRequest) => writeOp(STORE.syncQueue, (s) => s.put(item)),
  getQueue: () => readAll<QueuedRequest>(STORE.syncQueue),
  dequeue: (id: string) => writeOp(STORE.syncQueue, (s) => s.delete(id)),
  clearQueue: () => writeOp(STORE.syncQueue, (s) => s.clear()),

  // --- Offline road-alerts cache ---
  getRoadAlerts: () => readAll<RoadAlert>(STORE.roadAlerts),
  saveRoadAlerts: (items: RoadAlert[]) =>
    writeOp(STORE.roadAlerts, (s) => {
      s.clear();
      items.forEach((item) => s.put(item));
    }),
};
