export type OfflineArea = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  zoomMin: number;
  zoomMax: number;
  radiusTiles: number;
  progress: number;
  status: "downloading" | "downloaded" | "failed";
  tileCount: number;
  downloadedAt?: string;
};

import { ACTIVE_TILE_TEMPLATE } from "../config/mapStyle";

const CACHE_NAME = "nexus-map-offline-tiles-v2";
const STORAGE_KEY = "nexus-map-offline-areas";

const tileNumber = (latitude: number, longitude: number, zoom: number) => {
  const latRad = (latitude * Math.PI) / 180;
  const n = 2 ** zoom;
  return {
    x: Math.floor(((longitude + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n),
  };
};

/**
 * Must match what the map draws, or a completed download holds tiles nothing
 * ever requests — which is exactly how offline maps came to be broken.
 */
const tileUrl = (zoom: number, x: number, y: number) =>
  ACTIVE_TILE_TEMPLATE.replace("{z}", String(zoom))
    .replace("{x}", String(x))
    .replace("{y}", String(y));

const loadAreas = (): OfflineArea[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveAreas = (areas: OfflineArea[]) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify(areas));

export const offlineTileService = {
  getAreas: loadAreas,

  async downloadArea(
    input: Omit<OfflineArea, "id" | "progress" | "status" | "tileCount" | "downloadedAt">,
    onProgress?: (area: OfflineArea) => void,
  ): Promise<OfflineArea> {
    if (!("caches" in window)) throw new Error("Offline cache is not supported.");

    const id = crypto.randomUUID();
    const urls: string[] = [];

    for (let zoom = input.zoomMin; zoom <= input.zoomMax; zoom += 1) {
      const center = tileNumber(input.latitude, input.longitude, zoom);
      for (let x = center.x - input.radiusTiles; x <= center.x + input.radiusTiles; x += 1) {
        for (let y = center.y - input.radiusTiles; y <= center.y + input.radiusTiles; y += 1) {
          urls.push(tileUrl(zoom, x, y));
        }
      }
    }

    let area: OfflineArea = {
      id,
      ...input,
      progress: 0,
      status: "downloading",
      tileCount: urls.length,
    };

    saveAreas([area, ...loadAreas()]);
    onProgress?.(area);

    try {
      const cache = await caches.open(CACHE_NAME);
      for (let index = 0; index < urls.length; index += 1) {
        const url = urls[index];
        try {
          const response = await fetch(url, { mode: "cors", cache: "no-store" });
          if (response.ok) await cache.put(url, response.clone());
        } catch {}

        area = { ...area, progress: Math.round(((index + 1) / urls.length) * 100) };
        saveAreas(loadAreas().map((item) => (item.id === id ? area : item)));
        onProgress?.(area);
      }

      area = { ...area, progress: 100, status: "downloaded", downloadedAt: new Date().toISOString() };
      saveAreas(loadAreas().map((item) => (item.id === id ? area : item)));
      onProgress?.(area);
      return area;
    } catch (error) {
      area = { ...area, status: "failed" };
      saveAreas(loadAreas().map((item) => (item.id === id ? area : item)));
      onProgress?.(area);
      throw error;
    }
  },

  async removeArea(id: string) {
    saveAreas(loadAreas().filter((item) => item.id !== id));
  },

  async getCachedTileCount(): Promise<number> {
    if (!("caches" in window)) return 0;
    const cache = await caches.open(CACHE_NAME);
    return (await cache.keys()).length;
  },
};
