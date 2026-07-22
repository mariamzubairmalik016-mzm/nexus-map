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
