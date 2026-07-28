import { appEnv } from "./appEnv";

/**
 * The map's initial view, shared by the map component and by anything that
 * needs to know "where is the user looking" before the map has reported its
 * bounds (search biasing, mainly).
 *
 * Resolution order: the view the user last left the map at, then the
 * configured default centre. There is no hardcoded city — the default comes
 * from VITE_MAP_DEFAULT_LAT/LNG/ZOOM.
 */

const SAVED_VIEW_KEY = "nexus-map-last-view";

export type MapView = { lng: number; lat: number; zoom: number };

export const readSavedView = (): MapView | null => {
  try {
    const raw = localStorage.getItem(SAVED_VIEW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MapView;
    return Number.isFinite(parsed.lng) && Number.isFinite(parsed.lat) ? parsed : null;
  } catch {
    return null;
  }
};

export const writeSavedView = (view: MapView) => {
  try {
    localStorage.setItem(SAVED_VIEW_KEY, JSON.stringify(view));
  } catch {
    /* private mode / quota — remembering the view is a nicety, not a requirement */
  }
};

export const getInitialView = (): MapView =>
  readSavedView() ?? {
    lng: appEnv.defaultCenter.lng,
    lat: appEnv.defaultCenter.lat,
    zoom: appEnv.defaultCenter.zoom,
  };

/** Initial view as the { latitude, longitude } shape the rest of the app uses. */
export const getInitialCenter = () => {
  const view = getInitialView();
  return { latitude: view.lat, longitude: view.lng };
};

/**
 * Where the user has actually been, or null.
 *
 * Deliberately distinct from `getInitialCenter()`, which falls back to the
 * configured default centre. That default is 30.3753, 69.3451 — the geographic
 * centre of Pakistan, which is empty Balochistan desert. It is a fine place to
 * *open the map*, but it is not evidence of where the user is, and biasing
 * search towards it returned arbitrary rural roads for ordinary queries.
 *
 * Search should bias to a saved view (somewhere they navigated to) or a GPS
 * fix, and otherwise not bias at all.
 */
export const getSavedCenter = (): { latitude: number; longitude: number } | null => {
  const saved = readSavedView();
  return saved ? { latitude: saved.lat, longitude: saved.lng } : null;
};
