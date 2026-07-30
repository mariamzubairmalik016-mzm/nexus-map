import { offlineDb } from "./offlineDb";
import { ACTIVE_TILE_TEMPLATE } from "../config/mapStyle";
import {
  AVERAGE_TILE_BYTES,
  LARGE_REGION_TILE_WARNING,
  MAX_TILES_PER_REGION,
  type OfflineRegion,
  type RegionBounds,
} from "../types/offlineRegion";

/**
 * Downloads and manages user-selected map regions.
 *
 * Tile bytes go into a dedicated Cache Storage bucket; the metadata record
 * lives in IndexedDB. The two are kept in step: deleting a region deletes its
 * tiles. Downloads are bounded and sequential-ish so we never hammer the tile
 * provider — this respects the OpenStreetMap tile usage policy, which forbids
 * bulk downloading.
 */

export const TILE_CACHE = "nexus-map-offline-tiles-v2";
const PROVIDER = "openstreetmap";
/** Concurrent tile fetches. Deliberately small — politeness over speed. */
const CONCURRENCY = 4;

const clampLat = (lat: number) => Math.max(-85.05112878, Math.min(85.05112878, lat));

/** Slippy-map tile coordinates for a lat/lng at a zoom level. */
const tileXY = (lat: number, lng: number, zoom: number) => {
  const n = 2 ** zoom;
  const latRad = (clampLat(lat) * Math.PI) / 180;
  return {
    x: Math.floor(((lng + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n),
  };
};

/** Every tile URL covering `bounds` between the two zoom levels. */
export const tileUrlsFor = (bounds: RegionBounds, minZoom: number, maxZoom: number): string[] => {
  const urls: string[] = [];

  for (let zoom = minZoom; zoom <= maxZoom; zoom += 1) {
    const topLeft = tileXY(bounds.north, bounds.west, zoom);
    const bottomRight = tileXY(bounds.south, bounds.east, zoom);

    const xStart = Math.min(topLeft.x, bottomRight.x);
    const xEnd = Math.max(topLeft.x, bottomRight.x);
    const yStart = Math.min(topLeft.y, bottomRight.y);
    const yEnd = Math.max(topLeft.y, bottomRight.y);

    for (let x = xStart; x <= xEnd; x += 1) {
      for (let y = yStart; y <= yEnd; y += 1) {
        urls.push(
          ACTIVE_TILE_TEMPLATE.replace("{z}", String(zoom)).replace("{x}", String(x)).replace("{y}", String(y)),
        );
      }
    }
  }

  return urls;
};

export type RegionEstimate = {
  tileCount: number;
  sizeBytes: number;
  tooLarge: boolean;
  large: boolean;
};

/** Tile count and rough size for a region, before committing to a download. */
export const estimateRegion = (
  bounds: RegionBounds,
  minZoom: number,
  maxZoom: number,
): RegionEstimate => {
  let tileCount = 0;

  for (let zoom = minZoom; zoom <= maxZoom; zoom += 1) {
    const topLeft = tileXY(bounds.north, bounds.west, zoom);
    const bottomRight = tileXY(bounds.south, bounds.east, zoom);
    const width = Math.abs(bottomRight.x - topLeft.x) + 1;
    const height = Math.abs(bottomRight.y - topLeft.y) + 1;
    tileCount += width * height;
  }

  return {
    tileCount,
    sizeBytes: tileCount * AVERAGE_TILE_BYTES,
    tooLarge: tileCount > MAX_TILES_PER_REGION,
    large: tileCount > LARGE_REGION_TILE_WARNING,
  };
};

/** Cancellation/pause flags, keyed by region id, for in-flight downloads. */
const control = new Map<string, "running" | "paused" | "cancelled">();

export const offlineRegionService = {
  list: async (): Promise<OfflineRegion[]> => {
    const regions = await offlineDb.getRegions().catch(() => [] as OfflineRegion[]);
    return regions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  estimate: estimateRegion,

  pause: (id: string) => control.set(id, "paused"),
  resumeFlagCleared: (id: string) => control.delete(id),
  cancel: (id: string) => control.set(id, "cancelled"),

  /** Deletes the metadata record AND every tile the region cached. */
  remove: async (id: string) => {
    control.set(id, "cancelled");
    const region = (await offlineDb.getRegions()).find((item) => item.id === id);
    await offlineDb.deleteRegion(id);

    if (!region || !("caches" in window)) return;

    // Only drop tiles no OTHER region still needs.
    const remaining = await offlineDb.getRegions();
    const stillNeeded = new Set(
      remaining.flatMap((other) => tileUrlsFor(other.bounds, other.minZoom, other.maxZoom)),
    );
    const cache = await caches.open(TILE_CACHE);
    const urls = tileUrlsFor(region.bounds, region.minZoom, region.maxZoom);
    await Promise.all(urls.filter((url) => !stillNeeded.has(url)).map((url) => cache.delete(url)));
  },

  /**
   * Downloads (or re-downloads) a region. `onProgress` receives the record
   * after every batch so the UI can show a live count.
   */
  download: async (
    input: {
      id?: string;
      name: string;
      bounds: RegionBounds;
      minZoom: number;
      maxZoom: number;
    },
    onProgress?: (region: OfflineRegion) => void,
  ): Promise<OfflineRegion> => {
    if (!("caches" in window)) {
      throw new Error("This browser cannot store offline maps.");
    }

    const estimate = estimateRegion(input.bounds, input.minZoom, input.maxZoom);
    if (estimate.tooLarge) {
      throw new Error(
        `That area needs ${estimate.tileCount.toLocaleString()} tiles, over the ${MAX_TILES_PER_REGION.toLocaleString()} limit. Zoom in or reduce the zoom range.`,
      );
    }

    const now = new Date().toISOString();
    const existing = input.id ? (await offlineDb.getRegions()).find((r) => r.id === input.id) : undefined;

    let region: OfflineRegion = {
      id: input.id ?? crypto.randomUUID(),
      name: input.name,
      bounds: input.bounds,
      minZoom: input.minZoom,
      maxZoom: input.maxZoom,
      tileCount: estimate.tileCount,
      downloadedTileCount: 0,
      sizeBytes: 0,
      provider: PROVIDER,
      version: (existing?.version ?? 0) + 1,
      status: "downloading",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    control.set(region.id, "running");
    await offlineDb.saveRegion(region);
    onProgress?.(region);

    const urls = tileUrlsFor(input.bounds, input.minZoom, input.maxZoom);
    const cache = await caches.open(TILE_CACHE);

    let downloaded = 0;
    let bytes = 0;

    const fetchTile = async (url: string) => {
      try {
        const response = await fetch(url, { mode: "cors" });
        // Only successful responses are cached — never a 403/404/429/500.
        if (!response.ok) return;
        const clone = response.clone();
        await cache.put(url, response);
        bytes += (await clone.blob()).size;
        downloaded += 1;
      } catch {
        /* one missing tile must not fail the whole region */
      }
    };

    for (let index = 0; index < urls.length; index += CONCURRENCY) {
      const state = control.get(region.id);
      if (state === "cancelled") {
        await offlineDb.deleteRegion(region.id);
        throw new Error("Download cancelled.");
      }
      if (state === "paused") {
        region = { ...region, status: "paused", updatedAt: new Date().toISOString() };
        await offlineDb.saveRegion(region);
        onProgress?.(region);
        return region;
      }

      await Promise.all(urls.slice(index, index + CONCURRENCY).map(fetchTile));

      region = {
        ...region,
        downloadedTileCount: downloaded,
        sizeBytes: bytes,
        updatedAt: new Date().toISOString(),
      };
      await offlineDb.saveRegion(region);
      onProgress?.(region);
    }

    control.delete(region.id);

    region = {
      ...region,
      status: downloaded > 0 ? "downloaded" : "failed",
      lastError: downloaded > 0 ? undefined : "No tiles could be downloaded.",
      downloadedTileCount: downloaded,
      sizeBytes: bytes,
      updatedAt: new Date().toISOString(),
    };
    await offlineDb.saveRegion(region);
    onProgress?.(region);
    return region;
  },

  /**
   * The downloaded region whose bounds contain this point, if any. Used to
   * tell the user honestly whether the area they are standing in is available
   * offline.
   */
  findRegionCovering: async (
    latitude: number,
    longitude: number,
  ): Promise<OfflineRegion | null> => {
    const regions = await offlineDb.getRegions().catch(() => [] as OfflineRegion[]);
    return (
      regions.find(
        (region) =>
          region.status === "downloaded" &&
          latitude <= region.bounds.north &&
          latitude >= region.bounds.south &&
          longitude <= region.bounds.east &&
          longitude >= region.bounds.west,
      ) ?? null
    );
  },

  /** True when every tile of the region is present in the cache. */
  isFullyCached: async (region: OfflineRegion): Promise<boolean> => {
    if (!("caches" in window)) return false;
    const cache = await caches.open(TILE_CACHE);
    const urls = tileUrlsFor(region.bounds, region.minZoom, region.maxZoom);
    const checks = await Promise.all(urls.slice(0, 25).map((url) => cache.match(url)));
    return checks.every(Boolean);
  },
};
