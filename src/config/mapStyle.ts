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

/**
 * Which basemap to draw.
 *
 * This ignored its argument and always returned a Google style built on
 * `mt1.google.com/vt`, which broke offline maps outright: the service worker
 * caches `tile.openstreetmap.org`, and so does every downloaded region, so a
 * download saved tiles the map never asked for. The map requested Google
 * instead — cross-origin, never cached — and produced nothing the moment the
 * network went away.
 *
 * That endpoint is also unofficial and against Google's terms, and "google"
 * is not even a value `MapProviderId` allows. Honouring the configured
 * provider fixes offline and removes the violation in the same change.
 */
export const buildMapStyle = (provider: MapProviderId = appEnv.mapProvider): StyleSpecification =>
  provider === "tomtom" ? tomtomStyle() : osmStyle();

/** Traffic overlay — an optional layer, never part of the base style. */
export const TRAFFIC_TILE_TEMPLATE = `${appEnv.apiUrl}/navigation/traffic-tile/{z}/{x}/{y}`;
