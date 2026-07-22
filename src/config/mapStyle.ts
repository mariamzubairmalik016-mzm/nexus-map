import type { StyleSpecification } from "maplibre-gl";
import { appEnv, type MapProviderId } from "./appEnv";

/**
 * Base map styles for MapLibre GL.
 *
 * Both options are legal to use with this project's credentials:
 *  - "osm"    — OpenStreetMap raster tiles, attributed as the OSMF tile usage
 *               policy requires. No key, no proxy.
 *  - "tomtom" — TomTom raster tiles fetched through the backend proxy, so the
 *               TomTom key never reaches the browser.
 *
 * Google (or any other provider we are not licensed for) is deliberately not
 * an option here.
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
    { id: "background", type: "background", paint: { "background-color": "#050816" } },
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
    { id: "background", type: "background", paint: { "background-color": "#050816" } },
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

export const buildMapStyle = (provider: MapProviderId = appEnv.mapProvider): StyleSpecification =>
  provider === "tomtom" ? tomtomStyle() : osmStyle();

/** Traffic overlay — an optional layer, never part of the base style. */
export const TRAFFIC_TILE_TEMPLATE = `${appEnv.apiUrl}/navigation/traffic-tile/{z}/{x}/{y}`;
