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

const DB = "nexus-map-offline";
const VERSION = 3;
const PACKS = "packs";
const PLACES = "places";
const FAVORITES = "favorites";
const HISTORY = "history";
const QUEUE = "syncQueue";
const ROAD_ALERTS = "roadAlerts";

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PACKS)) db.createObjectStore(PACKS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(PLACES)) {
        const store = db.createObjectStore(PLACES, { keyPath: "id" });
        store.createIndex("packId", "packId");
      }
      if (!db.objectStoreNames.contains(FAVORITES)) db.createObjectStore(FAVORITES, { keyPath: "id" });
      if (!db.objectStoreNames.contains(HISTORY)) db.createObjectStore(HISTORY, { keyPath: "id" });
      if (!db.objectStoreNames.contains(QUEUE)) db.createObjectStore(QUEUE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(ROAD_ALERTS)) db.createObjectStore(ROAD_ALERTS, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const getAll = async <T>(store: string) => {
  const db = await openDb();
  return new Promise<T[]>((resolve, reject) => {
    const query = db.transaction(store, "readonly").objectStore(store).getAll();
    query.onsuccess = () => resolve(query.result as T[]);
    query.onerror = () => reject(query.error);
  });
};

const put = async <T>(store: string, value: T) => {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const query = db.transaction(store, "readwrite").objectStore(store).put(value);
    query.onsuccess = () => resolve();
    query.onerror = () => reject(query.error);
  });
};

const putMany = async <T>(store: string, values: T[]) => {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const objectStore = tx.objectStore(store);
    values.forEach((value) => objectStore.put(value));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const remove = async (store: string, id: string) => {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const query = db.transaction(store, "readwrite").objectStore(store).delete(id);
    query.onsuccess = () => resolve();
    query.onerror = () => reject(query.error);
  });
};

const clear = async (store: string) => {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const query = db.transaction(store, "readwrite").objectStore(store).clear();
    query.onsuccess = () => resolve();
    query.onerror = () => reject(query.error);
  });
};

export const offlineDb = {
  // --- Map packs (existing API, unchanged behaviour) ---
  getPacks: () => getAll<OfflinePack>(PACKS),
  savePack: (pack: OfflinePack) => put(PACKS, pack),
  deletePack: (id: string) => remove(PACKS, id),

  // --- Offline places / search (existing API) ---
  savePlaces: (items: OfflinePlace[]) => putMany(PLACES, items),
  searchPlaces: async (query: string) => {
    const items = await getAll<OfflinePlace>(PLACES);
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
  getFavorites: () => getAll<OfflineFavorite>(FAVORITES),
  saveFavorites: (items: OfflineFavorite[]) => putMany(FAVORITES, items),
  saveFavorite: (item: OfflineFavorite) => put(FAVORITES, item),
  deleteFavorite: (id: string) => remove(FAVORITES, id),

  // --- Offline trip/route history cache ---
  getHistory: () => getAll<OfflineHistoryItem>(HISTORY),
  saveHistory: (items: OfflineHistoryItem[]) => putMany(HISTORY, items),
  addHistory: (item: OfflineHistoryItem) => put(HISTORY, item),
  deleteHistory: (id: string) => remove(HISTORY, id),

  // --- Offline write queue (background sync) ---
  enqueue: (item: QueuedRequest) => put(QUEUE, item),
  getQueue: () => getAll<QueuedRequest>(QUEUE),
  dequeue: (id: string) => remove(QUEUE, id),
  clearQueue: () => clear(QUEUE),

  // --- Offline road-alerts cache ---
  getRoadAlerts: () => getAll<RoadAlert>(ROAD_ALERTS),
  saveRoadAlerts: async (items: RoadAlert[]) => {
    await clear(ROAD_ALERTS);
    await putMany(ROAD_ALERTS, items);
  },
};
