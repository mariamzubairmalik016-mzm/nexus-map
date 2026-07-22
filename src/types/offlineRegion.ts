export type OfflineRegionStatus =
  | "queued"
  | "downloading"
  | "paused"
  | "downloaded"
  | "failed"
  | "cancelled";

export type RegionBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

/**
 * Metadata for a map region the user downloaded. The tile bytes themselves
 * live in the Cache Storage bucket named by `provider`; this record is the
 * index the UI and the service worker reason about.
 */
export type OfflineRegion = {
  id: string;
  name: string;
  bounds: RegionBounds;
  minZoom: number;
  maxZoom: number;
  tileCount: number;
  downloadedTileCount: number;
  sizeBytes: number;
  provider: string;
  version: number;
  status: OfflineRegionStatus;
  createdAt: string;
  updatedAt: string;
  /** Set when the last download attempt failed, for display in the UI. */
  lastError?: string;
};

/** Average bytes per 256px OSM raster tile, measured, used for estimates. */
export const AVERAGE_TILE_BYTES = 14_000;

/** Refuse downloads beyond this — protects the device and the tile provider. */
export const MAX_TILES_PER_REGION = 6_000;

/** Warn (but still allow) above this many tiles. */
export const LARGE_REGION_TILE_WARNING = 1_500;
