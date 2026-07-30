import type { StyleSpecification } from "maplibre-gl";
import { appEnv, type MapProviderId } from "./appEnv";

/**
 * Base map styles for MapLibre GL.
 *
 * Modified to use Google Maps tiles as requested for the new design.
 */

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Tiles the service worker is allowed to serve from the offline region cache. */
export const OSM_TILE_TEMPLATE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const osmStyle = (): StyleSpecification => ({
  version: 8,
  sources: {
    "osm-raster": {
      type: "raster",
      tiles: [OSM_TILE_TEMPLATE],
      tileSize: 256,
      maxzoom: 19,
      attribution: OSM_ATTRIBUTION,
    },
  },
  layers: [
    // Dark canvas beneath the tiles so the app's look holds while tiles load
    // and wherever coverage is missing.
    { id: "background", type: "background", paint: { "background-color": "#060709" } },
    {
      id: "osm-raster",
      type: "raster",
      source: "osm-raster",
      paint: {
        // Tuned to sit inside the app's dark UI rather than glare against it.
        "raster-brightness-max": 0.82,
        "raster-saturation": -0.35,
        "raster-contrast": 0.12,
      },
    },
  ],
});

const tomtomStyle = (): StyleSpecification => ({
  version: 8,
  sources: {
    "tomtom-raster": {
      type: "raster",
      // Proxied by the backend — the API key stays server-side.
      tiles: [`${appEnv.apiUrl}/navigation/map-tile/{z}/{x}/{y}`],
      tileSize: 256,
      maxzoom: 20,
      attribution: "&copy; TomTom",
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#060709" } },
    {
      id: "tomtom-raster",
      type: "raster",
      source: "tomtom-raster",
      paint: {
        "raster-brightness-max": 0.85,
        "raster-saturation": -0.3,
        "raster-contrast": 0.1,
      },
    },
  ],
});

const googleStyle = (): StyleSpecification => ({
  version: 8,
  sources: {
    "google-raster": {
      type: "raster",
      tiles: ["https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"],
      tileSize: 256,
      maxzoom: 22,
      attribution: "&copy; Google Maps",
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#060709" } },
    {
      id: "google-raster",
      type: "raster",
      source: "google-raster",
      paint: {
        // The other two providers were already dimmed to sit inside the dark
        // UI; Google was left raw and glared against it. Same treatment, a
        // touch stronger because Google's default basemap is the brightest.
        "raster-brightness-max": 0.78,
        "raster-saturation": -0.4,
        "raster-contrast": 0.14,
      },
    },
  ],
});

/**
 * The tile URL the map actually draws.
 *
 * Exported because the offline feature has to download exactly these tiles.
 * They disagreed once already: the map drew Google while the service worker
 * and every region download saved OpenStreetMap, so a completed download held
 * tiles the map never asked for and offline maps produced nothing. Anything
 * that caches tiles must read this rather than hardcode a provider.
 */
export const ACTIVE_TILE_TEMPLATE =
  "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";

/** Hosts whose tiles the service worker may serve from the offline cache. */
export const TILE_HOSTS = ["mt0.google.com", "mt1.google.com", "mt2.google.com", "mt3.google.com"];

export const buildMapStyle = (provider: MapProviderId = appEnv.mapProvider): StyleSpecification =>
  googleStyle();

/** Traffic overlay — an optional layer, never part of the base style. */
export const TRAFFIC_TILE_TEMPLATE = `${appEnv.apiUrl}/navigation/traffic-tile/{z}/{x}/{y}`;
