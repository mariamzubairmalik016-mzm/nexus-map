import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type LngLatBoundsLike, type MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { AlertTriangle } from "lucide-react";

import { appEnv } from "../../config/appEnv";
import { buildMapStyle, TRAFFIC_TILE_TEMPLATE } from "../../config/mapStyle";
import { getInitialView, writeSavedView } from "../../config/mapView";
import type {
  CommunityNote,
  Coordinates,
  RouteAlternative,
  TrafficIncident,
} from "../../types/navigation";
import type { RoadAlert } from "../../types/roadAlerts";

export type MapBounds = { west: number; south: number; east: number; north: number };

type Props = {
  start: Coordinates | null;
  destination: Coordinates | null;
  selectedRoute: RouteAlternative | null;
  alternatives: RouteAlternative[];
  currentLocation: Coordinates | null;
  incidents: TrafficIncident[];
  communityNotes: CommunityNote[];
  roadAlerts?: RoadAlert[];
  showTraffic?: boolean;
  /**
   * Bumped when the user explicitly asks to be recentred (the GPS button).
   * An explicit request always wins, even after they have panned the map.
   */
  recenterRequest?: number;
  onAlertSelect?: (alert: RoadAlert) => void;
  onBoundsChange: (bounds: MapBounds) => void;
  onRouteSelect: (route: RouteAlternative) => void;
};

const ROUTE_SOURCE = "nexus-routes";
const ROUTE_CASING_LAYER = "nexus-routes-casing";
const ROUTE_LINE_LAYER = "nexus-routes-line";
const TRAFFIC_SOURCE = "nexus-traffic";
const TRAFFIC_LAYER = "nexus-traffic-layer";
const SEVERITY_COLOR: Record<string, string> = {
  low: "#34d399",
  medium: "#fbbf24",
  high: "#fb923c",
  critical: "#f87171",
};

/** City-level zoom used when the map centres on the user's GPS position. */
const GPS_ZOOM = 15;

/** Coarser grid when zoomed out -> fewer, bigger alert clusters. */
const gridPrecision = (zoom: number) => (zoom < 7 ? 1 : zoom < 9 ? 0.5 : 0.25);

const isUsable = (point: Coordinates | null | undefined): point is Coordinates =>
  !!point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude);

/**
 * Centres the map on a position at city zoom.
 *
 * The eased flyTo is driven by requestAnimationFrame, which does not fire while
 * the tab is hidden or unpainted — the same hazard the `ready` timer above
 * works around. A fix that arrives in a background tab would therefore start an
 * animation that never advances, and because the caller has already spent its
 * one-shot "centred" flag, the map would still be on the fallback view when the
 * user finally looks at it. So: animate when visible, jump when not.
 */
const centreOn = (map: maplibregl.Map, point: Coordinates, duration: number) => {
  const camera = { center: [point.longitude, point.latitude] as [number, number], zoom: GPS_ZOOM };
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    map.jumpTo(camera);
    return;
  }
  map.flyTo({ ...camera, duration });
};

/**
 * Runs a style operation (addSource/addLayer/setData) as soon as the style can
 * accept it.
 *
 * We deliberately do NOT gate on `load` / `idle` / `isStyleLoaded()`: those
 * proved unreliable here — with a slow raster tile server the map is fully
 * interactive and rendering long before `load` fires, and gating on it left
 * routes and markers permanently undrawn. Instead we simply try, and retry on
 * the next `styledata` if the style was not ready yet. Returns a cleanup that
 * cancels a pending retry.
 */
const whenStyleReady = (map: maplibregl.Map, operation: () => void): (() => void) => {
  const attempt = () => {
    try {
      operation();
      return true;
    } catch {
      return false;
    }
  };

  if (attempt()) return () => {};

  const retry = () => {
    if (attempt()) map.off("styledata", retry);
  };
  map.on("styledata", retry);
  return () => map.off("styledata", retry);
};

/** Builds a DOM element for a marker without going through React rendering. */
const createElement = (html: string, className = "") => {
  const element = document.createElement("div");
  element.className = className;
  element.innerHTML = html;
  return element;
};

const alertPinHtml = (alert: RoadAlert) => {
  const color = SEVERITY_COLOR[alert.severity] ?? "#94a3b8";
  const pulse = (alert.severity === "critical" || alert.severity === "high") && alert.status === "active";
  return `<div style="position:relative;width:22px;height:22px;cursor:pointer">${
    pulse ? `<span class="nexus-pin-ring" style="background:${color}55"></span>` : ""
  }<span class="nexus-pin" style="background:${color}"></span></div>`;
};

const dotHtml = (color: string, label: string) =>
  `<div title="${label}" style="width:26px;height:26px;border-radius:9999px;background:${color};border:3px solid #020617;box-shadow:0 4px 16px rgba(0,0,0,.55);display:grid;place-items:center;color:#020617;font-weight:800;font-size:11px">${label.charAt(0)}</div>`;

const MapLibreMap = ({
  start,
  destination,
  selectedRoute,
  alternatives,
  currentLocation,
  incidents,
  communityNotes,
  roadAlerts,
  showTraffic = false,
  recenterRequest = 0,
  onAlertSelect,
  onBoundsChange,
  onRouteSelect,
}: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [styleFailed, setStyleFailed] = useState(false);
  /** Set once the user pans/zooms/rotates themselves — suppresses auto-centring. */
  const userInteracted = useRef(false);
  const [zoom, setZoom] = useState(appEnv.defaultCenter.zoom);

  // Latest callbacks without re-creating the map when a parent re-renders.
  const boundsCallback = useRef(onBoundsChange);
  const routeCallback = useRef(onRouteSelect);
  const alertCallback = useRef(onAlertSelect);
  boundsCallback.current = onBoundsChange;
  routeCallback.current = onRouteSelect;
  alertCallback.current = onAlertSelect;

  /* ---------------------------------------------------------------- map init
     Created exactly once. The base map depends on nothing but the style — no
     traffic, alerts, routing, Supabase or AI — so a failure in any of those
     can never stop the map rendering. */
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    // Each map gets its OWN element inside the React-owned container. React
    // StrictMode mounts, unmounts and remounts this effect in development; if
    // both instances shared one container, the second map would be created
    // into a div still holding the first map's canvas and would never receive
    // its style. Removing this element in cleanup is guaranteed to work even
    // if maplibre's own remove() throws mid-initialisation.
    const host = document.createElement("div");
    host.style.width = "100%";
    host.style.height = "100%";
    containerRef.current.appendChild(host);

    const initial = getInitialView();
    const map = new maplibregl.Map({
      container: host,
      style: buildMapStyle(),
      center: [initial.lng, initial.lat],
      zoom: initial.zoom,
      attributionControl: { compact: true },
    });

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 90, unit: "metric" }), "bottom-left");

    // Defensive: getBounds() can throw while the style is still attaching.
    // This runs from event handlers and an animation frame, where an uncaught
    // throw would silently kill the rest of that callback.
    const emitBounds = () => {
      try {
        const bounds = map.getBounds();
        boundsCallback.current({
          west: bounds.getWest(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          north: bounds.getNorth(),
        });
        const center = map.getCenter();
        writeSavedView({ lng: center.lng, lat: center.lat, zoom: map.getZoom() });
      } catch {
        /* map not ready yet — a later moveend/load will emit real bounds */
      }
    };

    // Emit bounds on the next frame rather than waiting for `load`/`idle`:
    // center and zoom are known as soon as the map exists, and search biasing
    // must not wait for tiles to download (on a slow tile server that is many
    // seconds, during which every search would go out unbiased). Deferred by a
    // frame so it never runs in the middle of map construction.
    // A timer, NOT requestAnimationFrame: rAF does not fire in a backgrounded
    // or unpainted tab, which would leave the map permanently "not ready" and
    // its routes and markers undrawn. Timers still run there.
    const initialBounds = window.setTimeout(() => {
      // The map is usable now: markers can be added, and layer work is retried
      // by whenStyleReady until the style accepts it. Waiting for `load` here
      // would leave routes and markers undrawn whenever tiles are slow.
      // Set this BEFORE emitting bounds so nothing can prevent it.
      setReady(true);
      emitBounds();
    }, 0);

    map.on("load", emitBounds);
    map.once("idle", emitBounds);
    map.on("moveend", emitBounds);

    // A movement carrying an originalEvent came from the user (drag, wheel,
    // pinch, keyboard) rather than from our own flyTo/fitBounds. From then on
    // the viewport is theirs and we stop moving it automatically.
    const markUserInteraction = (event: { originalEvent?: unknown }) => {
      if (event.originalEvent) userInteracted.current = true;
    };
    map.on("dragstart", markUserInteraction);
    map.on("zoomstart", markUserInteraction);
    map.on("rotatestart", markUserInteraction);

    // Exposed in development only, to inspect map state from the console.
    if (import.meta.env.DEV) {
      (window as unknown as { __nexusMap?: maplibregl.Map }).__nexusMap = map;
    }
    map.on("zoom", () => setZoom(map.getZoom()));

    // A failed tile is normal (offline, or outside coverage) and must not blank
    // the map. Only a style-level failure — no basemap at all — is surfaced.
    map.on("error", (event) => {
      const message = String((event as { error?: Error }).error?.message ?? "");
      if (/style/i.test(message)) setStyleFailed(true);
      if (import.meta.env.DEV) console.debug("[map]", message);
    });

    return () => {
      // Clear the ref FIRST. maplibre's remove() can throw when the map is
      // torn down before its style finished loading (which is exactly what
      // React StrictMode's mount/unmount/mount does in development). If that
      // throw skipped this assignment, the remount would early-return and the
      // app would be left with a half-destroyed map that renders tiles but
      // never fires load/idle/moveend.
      mapRef.current = null;
      window.clearTimeout(initialBounds);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      try {
        map.remove();
      } catch {
        /* already partially torn down — the host removal below still cleans up */
      }
      host.remove();
      setReady(false);
    };
  }, []);

  /* ------------------------------------------------------------ route lines */
  const routeGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: alternatives
        .filter((route) => route.coordinates.length > 1)
        .map((route) => ({
          type: "Feature" as const,
          properties: {
            routeId: route.id,
            selected: route.id === selectedRoute?.id ? 1 : 0,
          },
          geometry: {
            type: "LineString" as const,
            // Provider coordinates are [lat, lng]; GeoJSON needs [lng, lat].
            coordinates: route.coordinates.map(([lat, lng]) => [lng, lat]),
          },
        })),
    }),
    [alternatives, selectedRoute],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    return whenStyleReady(map, () => {
      const existing = map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (existing) {
        existing.setData(routeGeoJson);
        return;
      }

      map.addSource(ROUTE_SOURCE, { type: "geojson", data: routeGeoJson });
      map.addLayer({
        id: ROUTE_CASING_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#020617",
          "line-width": ["case", ["==", ["get", "selected"], 1], 11, 7],
          "line-opacity": 0.55,
        },
      });
      map.addLayer({
        id: ROUTE_LINE_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["case", ["==", ["get", "selected"], 1], "#22d3ee", "#64748b"],
          "line-width": ["case", ["==", ["get", "selected"], 1], 6, 4],
          "line-opacity": ["case", ["==", ["get", "selected"], 1], 0.95, 0.65],
        },
      });

      const handleRouteClick = (event: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        const routeId = event.features?.[0]?.properties?.routeId;
        if (!routeId) return;
        const match = alternatives.find((route) => route.id === routeId);
        if (match) routeCallback.current(match);
      };
      map.on("click", ROUTE_LINE_LAYER, handleRouteClick);
      map.on("mouseenter", ROUTE_LINE_LAYER, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", ROUTE_LINE_LAYER, () => {
        map.getCanvas().style.cursor = "";
      });
    });
  }, [alternatives, ready, routeGeoJson]);

  /* ------------------------------------------- fit the map to the full route */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    if (selectedRoute?.coordinates.length) {
      const lats = selectedRoute.coordinates.map(([lat]) => lat);
      const lngs = selectedRoute.coordinates.map(([, lng]) => lng);
      const bounds: LngLatBoundsLike = [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ];
      map.fitBounds(bounds, { padding: 70, duration: 900 });
    }
  }, [ready, selectedRoute]);

  /* ------------------------------- open near GPS the first time a fix arrives
     Centres on the user's real position at city zoom as soon as a fix is
     available — including a fix that only arrives later, e.g. because
     permission was granted after the page opened.

     Two guards keep it from ever feeling like the map "jumps":
       - it happens at most once (centredOnGps)
       - it is skipped once the user has panned/zoomed themselves, or once a
         route is on screen (fitBounds owns the viewport then).                */
  const centredOnGps = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || centredOnGps.current || userInteracted.current) return;
    if (!isUsable(currentLocation) || selectedRoute) return;

    centredOnGps.current = true;
    centreOn(map, currentLocation, 1200);
  }, [currentLocation, ready, selectedRoute]);

  /* --------------------------------- explicit "centre on me" (GPS button) ---
     Unlike the automatic centring above, this ignores the interaction guard:
     the user asked for it, so it always moves the map.                       */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || recenterRequest === 0 || !isUsable(currentLocation)) return;
    centreOn(map, currentLocation, 1000);
    // Only re-run when a NEW request comes in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterRequest]);

  /* -------------------------------------------------- optional traffic layer */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const hasLayer = Boolean(map.getLayer(TRAFFIC_LAYER));

    if (showTraffic && !hasLayer) {
      map.addSource(TRAFFIC_SOURCE, {
        type: "raster",
        tiles: [TRAFFIC_TILE_TEMPLATE],
        tileSize: 256,
      });
      map.addLayer({
        id: TRAFFIC_LAYER,
        type: "raster",
        source: TRAFFIC_SOURCE,
        paint: { "raster-opacity": 0.75 },
      });
    }

    if (!showTraffic && hasLayer) {
      map.removeLayer(TRAFFIC_LAYER);
      if (map.getSource(TRAFFIC_SOURCE)) map.removeSource(TRAFFIC_SOURCE);
    }
  }, [ready, showTraffic]);

  /* ------------------------------------------------------------- all markers
     Rebuilt as one set so there is never a stale or duplicated marker. */
  const rebuildMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const add = (lng: number, lat: number, element: HTMLElement) => {
      const marker = new maplibregl.Marker({ element }).setLngLat([lng, lat]).addTo(map);
      markersRef.current.push(marker);
      return marker;
    };

    if (isUsable(start)) {
      add(start.longitude, start.latitude, createElement(dotHtml("#34d399", "Start")));
    }
    if (isUsable(destination)) {
      add(destination.longitude, destination.latitude, createElement(dotHtml("#f87171", "Destination")));
    }

    if (isUsable(currentLocation)) {
      add(
        currentLocation.longitude,
        currentLocation.latitude,
        createElement(
          `<div style="position:relative;width:20px;height:20px">
             <span class="nexus-pin-ring" style="background:#22d3ee55"></span>
             <span class="nexus-pin" style="background:#22d3ee;width:20px;height:20px"></span>
           </div>`,
        ),
      );
    }

    incidents.forEach((incident) => {
      if (!incident.position) return;
      const element = createElement(dotHtml("#fbbf24", "Incident"));
      const marker = add(incident.position.longitude, incident.position.latitude, element);
      marker.setPopup(
        new maplibregl.Popup({ offset: 18 }).setHTML(
          `<strong>${incident.title}</strong><br/>${incident.description ?? ""}`,
        ),
      );
    });

    communityNotes.forEach((note) => {
      const element = createElement(dotHtml("#a78bfa", "Community"));
      const marker = add(note.position.longitude, note.position.latitude, element);
      marker.setPopup(
        new maplibregl.Popup({ offset: 18 }).setHTML(
          `<strong>${note.title}</strong><p>${note.description}</p><small>${note.status} · ${note.helpfulCount} helpful</small>`,
        ),
      );
    });

    // Road alerts: individual pins when zoomed in, count badges when zoomed out.
    const alerts = roadAlerts ?? [];
    if (zoom >= 11) {
      alerts.forEach((alert) => {
        const element = createElement(alertPinHtml(alert));
        element.addEventListener("click", () => alertCallback.current?.(alert));
        add(alert.longitude, alert.latitude, element);
      });
    } else {
      const precision = gridPrecision(zoom);
      const cells = new Map<string, { lat: number; lng: number; items: RoadAlert[] }>();
      for (const alert of alerts) {
        const key = `${Math.round(alert.latitude / precision)}_${Math.round(alert.longitude / precision)}`;
        const cell = cells.get(key) ?? { lat: 0, lng: 0, items: [] };
        cell.items.push(alert);
        cell.lat += alert.latitude;
        cell.lng += alert.longitude;
        cells.set(key, cell);
      }

      cells.forEach((cell) => {
        const lat = cell.lat / cell.items.length;
        const lng = cell.lng / cell.items.length;

        if (cell.items.length === 1) {
          const alert = cell.items[0];
          const element = createElement(alertPinHtml(alert));
          element.addEventListener("click", () => alertCallback.current?.(alert));
          add(lng, lat, element);
          return;
        }

        const element = createElement(
          `<div class="nexus-cluster" style="cursor:pointer">${cell.items.length}</div>`,
        );
        element.addEventListener("click", () =>
          map.flyTo({ center: [lng, lat], zoom: Math.min(16, map.getZoom() + 3) }),
        );
        add(lng, lat, element);
      });
    }
  }, [communityNotes, currentLocation, destination, incidents, ready, roadAlerts, start, zoom]);

  useEffect(() => {
    rebuildMarkers();
  }, [rebuildMarkers]);

  return (
    <div className="relative h-full min-h-[760px] w-full">
      <div ref={containerRef} className="h-full min-h-[760px] w-full" />

      {styleFailed && (
        <div className="absolute inset-0 z-[800] grid place-items-center bg-[#050816]/95 p-6 text-center">
          <div className="max-w-sm">
            <AlertTriangle className="mx-auto text-amber-400" size={30} />
            <h3 className="mt-3 text-lg font-semibold text-white">Map style could not be loaded</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              The base map provider is unreachable. Check your connection, or open a downloaded
              region from Offline Maps.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapLibreMap;
