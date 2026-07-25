import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Bike,
  Bookmark,
  Bot,
  Car,
  Footprints,
  LocateFixed,
  Navigation,
  PauseCircle,
  PlayCircle,
  Route,
  Send,
  Sparkles,
  Trash2,
  WifiOff,
} from "lucide-react";
import toast from "react-hot-toast";

import SearchAutocomplete from "../../components/map/SearchAutocomplete";
import dynamic from "next/dynamic";

const MapLibreMap = dynamic(() => import("../../components/map/MapLibreMap"), {
  ssr: false,
});
import ErrorBoundary from "../../components/ui/ErrorBoundary";
import { AnimatePresence, motion } from "framer-motion";

import { navigationApi } from "../../services/navigationApi";
import { offlineDb } from "../../services/offlineDb";
import { roadAlertsService, usableAlerts } from "../../services/roadAlertsService";
import { networkStatus } from "../../services/networkStatus";
import { savedRouteService, savedRouteToAlternative } from "../../services/savedRouteService";
import { offlineRegionService } from "../../services/offlineRegionService";
import AlertDetailPanel from "../../components/map/AlertDetailPanel";
import { useLiveNavigation } from "../../hooks/useLiveNavigation";
import { useGeolocation, currentLocationSuggestion } from "../../hooks/useGeolocation";
import { useInternetStatus } from "../../hooks/useInternetStatus";
import { getInitialCenter } from "../../config/mapView";
import type { RoadAlert } from "../../types/roadAlerts";
import type { RouteType, SavedRoute, TravelMode } from "../../types/savedRoute";

const isValidCoord = (c: Coordinates | null): c is Coordinates =>
  !!c &&
  Number.isFinite(c.latitude) &&
  Number.isFinite(c.longitude) &&
  c.latitude >= -90 &&
  c.latitude <= 90 &&
  c.longitude >= -180 &&
  c.longitude <= 180;

const friendlyRouteError = (error: unknown): string => {
  const msg = error instanceof Error ? error.message.toLowerCase() : "";
  if (msg.includes("no_route") || msg.includes("no route") || msg.includes("productid"))
    return "No route found between these places.";
  if (msg.includes("offline") || msg.includes("failed to fetch") || msg.includes("network"))
    return "Check your internet connection and try again.";
  if (msg.includes("500") || msg.includes("503") || msg.includes("unavailable") || msg.includes("temporarily"))
    return "The routing service is temporarily unavailable.";
  return "Unable to calculate a route. Please try again.";
};
import type {
  CommunityNote,
  Coordinates,
  RouteAlternative,
  SearchSuggestion,
  TrafficIncident,
} from "../../types/navigation";

type Bounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

const formatMinutes = (seconds: number) =>
  `${Math.max(1, Math.round(seconds / 60))} min`;

/**
 * Largest map span (in degrees) we will request traffic incidents for. The
 * provider returns 400 for continent-sized bounding boxes, and incidents are
 * only meaningful once the user has zoomed into a city anyway.
 */
const MAX_INCIDENT_SPAN_DEGREES = 2;

const MapPage = () => {
  const [searchParams] = useSearchParams();
  const online = useInternetStatus();

  // Typed text and the confirmed selection are separate on purpose: a typed
  // string is NOT a location. `start`/`destination` are only ever set by
  // picking a suggestion or by a GPS fix, and are cleared the moment the
  // matching text is edited.
  const [startQuery, setStartQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [selectedStart, setSelectedStart] = useState<SearchSuggestion | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<SearchSuggestion | null>(null);

  const start = selectedStart?.position ?? null;
  const destination = selectedDestination?.position ?? null;

  const [routes, setRoutes] = useState<RouteAlternative[]>([]);
  const [selectedRoute, setSelectedRoute] =
    useState<RouteAlternative | null>(null);
  const [incidents, setIncidents] = useState<TrafficIncident[]>([]);
  const [communityNotes, setCommunityNotes] =
    useState<CommunityNote[]>([]);
  const [busy, setBusy] = useState(false);
  const [travelMode, setTravelMode] = useState<TravelMode>("car");
  const [routeType, setRouteType] = useState<RouteType>("fastest");
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidFerries, setAvoidFerries] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [mapCenter, setMapCenter] = useState<Coordinates | null>(null);
  const [recenterRequest, setRecenterRequest] = useState(0);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<string[]>([
    "Nexus AI: Select a route and ask about ETA, traffic, destination or road conditions.",
  ]);

  const [roadAlerts, setRoadAlerts] = useState<RoadAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<RoadAlert | null>(null);
  const [alertBusy, setAlertBusy] = useState(false);

  const [showTraffic, setShowTraffic] = useState(false);

  const live = useLiveNavigation();
  const geo = useGeolocation();
  const activeRoute = live.activeRoute ?? selectedRoute;

  /**
   * Where search results are biased towards: the user's GPS fix when we have
   * one, then the live tracking position, then wherever the map is currently
   * pointed, and finally the map's initial view (the user's last saved view,
   * or the configured default centre). The last fallback matters because it is
   * available on the very first render — waiting for the map to report bounds
   * would let early searches go out unbiased. No hardcoded city anywhere.
   */
  const searchBias = geo.coordinates ?? live.current ?? mapCenter ?? getInitialCenter();

  /**
   * Adopts a GPS fix as the starting point. Only overwrites the start when the
   * user has not already chosen one, so an automatic fix arriving late can
   * never replace a place they deliberately picked.
   */
  const selectedStartRef = useRef<SearchSuggestion | null>(null);
  selectedStartRef.current = selectedStart;

  const adoptGpsAsStart = useCallback((coordinates: Coordinates, { force = false } = {}) => {
    // Read the current selection from a ref, not inside a state updater —
    // updaters must stay pure, and a setState nested in one is dropped.
    const current = selectedStartRef.current;
    if (current && !force && current.id !== "current-location") return;

    setSelectedStart(currentLocationSuggestion(coordinates));
    setStartQuery("Current Location");
  }, []);

  /**
   * GPS button. Calls the browser Geolocation API directly — no backend, no
   * tracking mode — and makes the fix the selected start point so a route can
   * be generated immediately. Explicit, so it overrides any existing start.
   */
  const useCurrentLocation = async () => {
    const coordinates = await geo.getCurrentLocation();
    if (!coordinates) {
      toast.error(geo.error || "Unable to detect your location.");
      return;
    }
    adoptGpsAsStart(coordinates, { force: true });
    // Explicit request — recentre even if the user has panned the map since.
    setRecenterRequest((count) => count + 1);
    toast.success("Using your current location.");
  };

  /**
   * On opening the map, ask for GPS once. Granted -> the map centres on the
   * real position and "Current Location" becomes the start point. Denied or
   * unavailable -> the map stays on the last saved view (or the configured
   * default) and we explain why, rather than jumping somewhere arbitrary.
   *
   * This is getCurrentPosition only. Continuous watchPosition tracking is
   * started exclusively by the user pressing Start Navigation.
   */
  const autoLocateDone = useRef(false);
  useEffect(() => {
    if (autoLocateDone.current) return;
    autoLocateDone.current = true;

    void geo.getCurrentLocation().then((coordinates) => {
      if (coordinates) adoptGpsAsStart(coordinates);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * If permission is granted later (the user flips it in site settings while
   * the page is open), pick the fix up automatically instead of making them
   * reload.
   */
  useEffect(() => {
    if (!("permissions" in navigator)) return;
    let status: PermissionStatus | null = null;

    const onChange = () => {
      if (status?.state !== "granted") return;
      void geo.getCurrentLocation().then((coordinates) => {
        if (coordinates) adoptGpsAsStart(coordinates);
      });
    };

    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((result) => {
        status = result;
        result.addEventListener("change", onChange);
      })
      .catch(() => {
        /* Permissions API unsupported — the GPS button still works */
      });

    return () => status?.removeEventListener("change", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAlerts = useCallback(async () => {
    // Offline: never poll a live endpoint. The cached alerts already on screen
    // (and in IndexedDB) stay as they are.
    if (networkStatus.isOffline()) return;
    try {
      const { alerts } = await roadAlertsService.list({ status: "active" });
      setRoadAlerts(alerts);
    } catch {
      /* keep previous alerts */
    }
  }, []);

  useEffect(() => {
    // Hydrate from the cache on first paint. Filtered like every other entry
    // point: a cache written before validation existed can still hold an alert
    // with no coordinates, which would crash the map on render.
    void offlineDb
      .getRoadAlerts()
      .then((cached) => usableAlerts(cached))
      .then((cached) => setRoadAlerts((current) => (current.length ? current : cached)))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    // Alerts are an OPTIONAL live layer: only polled while online, and the
    // interval is torn down the moment connectivity drops.
    if (!online) return;

    void loadAlerts();
    const unsubscribe = roadAlertsService.subscribeRealtime(() => void loadAlerts());
    const timer = window.setInterval(() => void loadAlerts(), 45_000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [loadAlerts, online]);

  useEffect(() => {
    void savedRouteService.list().then(setSavedRoutes);
  }, []);

  /**
   * Offline, GPS still works and the map still centres on the real position —
   * but the tiles for that area only exist if a region covering it was
   * downloaded. Check, and say so plainly rather than showing a blank map.
   */
  const [offlineCoverage, setOfflineCoverage] = useState<"unknown" | "covered" | "missing">("unknown");
  useEffect(() => {
    const position = geo.coordinates ?? live.current;
    if (online || !position) {
      setOfflineCoverage("unknown");
      return;
    }
    void offlineRegionService
      .findRegionCovering(position.latitude, position.longitude)
      .then((region) => setOfflineCoverage(region ? "covered" : "missing"))
      .catch(() => setOfflineCoverage("missing"));
  }, [geo.coordinates, live.current, online]);

  const alertDistanceKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
    const R = 6371;
    const dLat = ((bLat - aLat) * Math.PI) / 180;
    const dLng = ((bLng - aLng) * Math.PI) / 180;
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  };

  const countOnRoute = useCallback(
    (route: RouteAlternative | null) =>
      route
        ? roadAlerts.filter((alert) =>
            route.coordinates.some(
              (c, i) => i % 4 === 0 && alertDistanceKm(alert.latitude, alert.longitude, c[0], c[1]) < 0.35,
            ),
          ).length
        : 0,
    [roadAlerts],
  );

  const alertsOnRoute = useMemo(
    () =>
      activeRoute
        ? roadAlerts.filter((alert) =>
            activeRoute.coordinates.some(
              (c, i) => i % 4 === 0 && alertDistanceKm(alert.latitude, alert.longitude, c[0], c[1]) < 0.35,
            ),
          )
        : [],
    [activeRoute, roadAlerts],
  );

  const recalcAvoidingAlerts = () => {
    if (routes.length < 2) {
      toast.error("No alternative route available to avoid alerts.");
      return;
    }
    const best = [...routes].sort((a, b) => countOnRoute(a) - countOnRoute(b))[0];
    if (best && best.id !== selectedRoute?.id && countOnRoute(best) < countOnRoute(selectedRoute)) {
      setSelectedRoute(best);
      setSelectedAlert(null);
      toast.success("Switched to a route with fewer alerts.");
    } else {
      toast("Already on the route with the fewest alerts.", { icon: "ℹ️" });
    }
  };

  const confirmAlert = async (id: string) => {
    try {
      setAlertBusy(true);
      await roadAlertsService.confirm(id);
      await loadAlerts();
      toast.success("Thanks — marked still active.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setAlertBusy(false);
    }
  };

  const resolveAlert = async (id: string) => {
    try {
      setAlertBusy(true);
      await roadAlertsService.resolve(id);
      await loadAlerts();
      setSelectedAlert(null);
      toast.success("Marked as resolved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setAlertBusy(false);
    }
  };

  useEffect(() => {
    const place = searchParams.get("place");
    const latitude = Number(searchParams.get("lat"));
    const longitude = Number(searchParams.get("lng"));

    if (
      place &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    ) {
      setDestinationQuery(place);
      setSelectedDestination({
        id: `link-${place}`,
        provider: "offline",
        name: place,
        displayName: place,
        address: place,
        lat: latitude,
        lng: longitude,
        position: { latitude, longitude },
      });
    }
  }, [searchParams]);


  const calculateRoutes = async () => {
    // Require real, selected coordinates — a typed string is not a location.
    if (!isValidCoord(start) || !isValidCoord(destination)) {
      toast.error("Please select a valid starting point and destination from the suggestions.");
      return;
    }
    if (start.latitude === destination.latitude && start.longitude === destination.longitude) {
      toast.error("Start and destination are the same place.");
      return;
    }
    if (!online) {
      toast.error("This route is not available offline. Save or download it while online first.");
      return;
    }

    try {
      setBusy(true);
      const result = await navigationApi.routes(start, destination, {
        travelMode,
        routeType,
        avoidTolls,
        avoidFerries,
        alternatives: 2,
      });

      if (!result.length) {
        toast.error("No route found between these places.");
        return;
      }

      setRoutes(result);
      setSelectedRoute(result[0]);

      const best = result[0];
      void offlineDb.addHistory({
        id: crypto.randomUUID(),
        startName: startQuery || "Start",
        destinationName: destinationQuery || "Destination",
        distanceKm: Math.round((best.summary.lengthMeters / 1000) * 10) / 10,
        durationMinutes: Math.round(best.summary.travelTimeSeconds / 60),
        createdAt: new Date().toISOString(),
      });

      toast.success("Route ready.");
    } catch (error) {
      // Friendly message only; full error stays in the dev console.
      if (import.meta.env.DEV) console.error("[route]", error);
      toast.error(friendlyRouteError(error));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (start && destination && routes.length === 0 && !busy) {
      void calculateRoutes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, destination]);

  /** Stores the selected route (geometry + instructions) for offline reuse. */
  const saveCurrentRoute = async () => {
    if (!selectedRoute) return;
    try {
      const saved = await savedRouteService.save({
        title: `${startQuery || "Start"} → ${destinationQuery || "Destination"}`,
        route: selectedRoute,
        originName: startQuery || "Start",
        destinationName: destinationQuery || "Destination",
        travelMode,
        routeType,
        avoidTolls,
        avoidFerries,
      });
      setSavedRoutes((current) => [saved, ...current]);
      toast.success("Route saved — it will open offline.");
    } catch {
      toast.error("Could not save this route on this device.");
    }
  };

  /** Reopens a saved route from IndexedDB — no routing provider involved. */
  const openSavedRoute = (saved: SavedRoute) => {
    const alternative = savedRouteToAlternative(saved);
    setRoutes([alternative]);
    setSelectedRoute(alternative);
    setStartQuery(saved.originName);
    setDestinationQuery(saved.destinationName);
    setSelectedStart({
      id: `saved-origin-${saved.id}`,
      provider: "offline",
      name: saved.originName,
      displayName: saved.originName,
      address: saved.originName,
      position: saved.origin,
    });
    setSelectedDestination({
      id: `saved-destination-${saved.id}`,
      provider: "offline",
      name: saved.destinationName,
      displayName: saved.destinationName,
      address: saved.destinationName,
      position: saved.destination,
    });
    setTravelMode(saved.travelMode);
    setRouteType(saved.routeType);
    setAvoidTolls(saved.avoidTolls);
    setAvoidFerries(saved.avoidFerries);
    toast.success("Saved route opened.");
  };

  const deleteSavedRoute = async (id: string) => {
    await savedRouteService.remove(id);
    setSavedRoutes((current) => current.filter((route) => route.id !== id));
  };

  const handleBoundsChange = useCallback(
    (bounds: Bounds) => {
      // Bias search to what the user is actually looking at. Without this,
      // searching "Lucky One Mall Karachi" with no GPS permission returns
      // same-named places abroad. This is the map's real centre — never a
      // hardcoded city.
      setMapCenter({
        latitude: (bounds.north + bounds.south) / 2,
        longitude: (bounds.east + bounds.west) / 2,
      });

      // Traffic incidents and community notes are OPTIONAL live layers —
      // never requested while offline, so panning offline makes no calls.
      if (networkStatus.isOffline()) return;

      // The incidents API rejects very large areas with a 400. Asking for a
      // whole country's incidents is pointless anyway, so skip the call rather
      // than let it fail on every pan at low zoom.
      const spanDegrees = Math.max(bounds.north - bounds.south, bounds.east - bounds.west);
      if (spanDegrees > MAX_INCIDENT_SPAN_DEGREES) {
        setIncidents([]);
        setCommunityNotes([]);
        return;
      }

      void Promise.all([
        navigationApi.trafficIncidents(
          bounds.west,
          bounds.south,
          bounds.east,
          bounds.north,
        ),
        navigationApi.communityNotes(
          bounds.west,
          bounds.south,
          bounds.east,
          bounds.north,
        ),
      ])
        .then(([traffic, notes]) => {
          setIncidents(traffic);
          setCommunityNotes(notes);
        })
        .catch(() => {
          setIncidents([]);
        });
    },
    [],
  );

  const nextInstruction = useMemo(
    () => activeRoute?.instructions[0] ?? null,
    [activeRoute],
  );

  const askAi = () => {
    const clean = question.trim();
    if (!clean) return;

    const answer = activeRoute
      ? `Nexus AI: The selected route is ${(
          activeRoute.summary.lengthMeters / 1000
        ).toFixed(1)} km, takes about ${formatMinutes(
          activeRoute.summary.travelTimeSeconds,
        )}, and currently includes ${Math.round(
          activeRoute.summary.trafficDelaySeconds / 60,
        )} minutes of traffic delay.`
      : "Nexus AI: Select a starting point and destination first.";

    setMessages((current) => [
      ...current,
      `You: ${clean}`,
      answer,
    ]);
    setQuestion("");
  };

  return (
    <section className="min-h-[calc(100vh-80px)] bg-[#020617] px-3 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px]">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.28em] text-cyan-400">
            Global live navigation
          </p>
          <h1 className="mt-2 text-4xl font-bold sm:text-5xl">
            Navigate anywhere in the world
          </h1>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="nexus-glass-elevated grid overflow-hidden xl:grid-cols-[420px_minmax(0,1fr)]"
        >
          <motion.aside
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="nexus-glass max-h-[920px] overflow-y-auto border-b border-white/10 p-5 xl:border-b-0 xl:border-r"
          >
            <div className="flex items-center gap-3">
              <Route className="text-purple-400" />
              <h2 className="text-2xl font-bold">
                Smart Route Planner
              </h2>
            </div>

            {!online && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm text-amber-100">
                <WifiOff size={17} className="mt-0.5 shrink-0" />
                <p className="leading-6">
                  You are offline. Search uses saved and cached places, and saved routes still
                  open. New routes need a connection.
                </p>
              </div>
            )}

            <div className="mt-5 space-y-4">
              <SearchAutocomplete
                label="Starting point"
                value={startQuery}
                placeholder="Your location or any place"
                bias={searchBias}
                selected={Boolean(selectedStart)}
                onChange={(value) => {
                  setStartQuery(value);
                  // Editing the text invalidates the confirmed selection.
                  setSelectedStart(null);
                }}
                onSelect={setSelectedStart}
                accent="emerald"
              />

              <button
                type="button"
                onClick={() => void useCurrentLocation()}
                disabled={geo.loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-sm disabled:opacity-60"
              >
                <LocateFixed size={17} />
                {geo.loading ? "Locating…" : "Use current GPS location"}
              </button>

              {geo.error && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-200">
                  <p>{geo.error}</p>
                  <p className="mt-1 text-amber-200/70">
                    Showing your last map position instead. Enable location for the best experience.
                  </p>
                </div>
              )}

              {offlineCoverage === "missing" && (
                <p className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-200">
                  This area has not been downloaded for offline use. Your location is still
                  accurate — download this region from Offline Maps while online to see the map here.
                </p>
              )}

              <SearchAutocomplete
                label="Destination"
                value={destinationQuery}
                placeholder="Street, village, city or landmark"
                bias={searchBias}
                selected={Boolean(selectedDestination)}
                onChange={(value) => {
                  setDestinationQuery(value);
                  setSelectedDestination(null);
                }}
                onSelect={async (suggestion) => {
                  setSelectedDestination(suggestion);
                  
                  let startCoords = geo.coordinates;
                  if (!startCoords && !selectedStartRef.current) {
                    startCoords = await geo.getCurrentLocation();
                    if (startCoords) {
                      adoptGpsAsStart(startCoords);
                    }
                  } else if (startCoords && !selectedStartRef.current) {
                    adoptGpsAsStart(startCoords);
                  }
                }}
                accent="red"
              />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {(
                [
                  { id: "car", label: "Drive", icon: Car },
                  { id: "pedestrian", label: "Walk", icon: Footprints },
                  { id: "bicycle", label: "Cycle", icon: Bike },
                ] as const
              ).map((mode) => {
                const Icon = mode.icon;
                const active = travelMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setTravelMode(mode.id)}
                    className={`flex flex-col items-center gap-1 rounded-2xl border py-3 text-xs transition ${
                      active
                        ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                        : "border-white/10 bg-white/[0.03] text-slate-400"
                    }`}
                  >
                    <Icon size={17} />
                    {mode.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["fastest", "shortest"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setRouteType(type)}
                  className={`rounded-2xl border py-3 text-xs capitalize transition ${
                    routeType === type
                      ? "border-purple-400/40 bg-purple-500/10 text-purple-200"
                      : "border-white/10 bg-white/[0.03] text-slate-400"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <label className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
              Avoid toll roads
              <input
                type="checkbox"
                checked={avoidTolls}
                onChange={(event) =>
                  setAvoidTolls(event.target.checked)
                }
                className="h-5 w-5 accent-cyan-500"
              />
            </label>

            <label className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
              Avoid ferries
              <input
                type="checkbox"
                checked={avoidFerries}
                onChange={(event) => setAvoidFerries(event.target.checked)}
                className="h-5 w-5 accent-cyan-500"
              />
            </label>

            <label className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
              Show live traffic layer
              <input
                type="checkbox"
                checked={showTraffic}
                onChange={(event) => setShowTraffic(event.target.checked)}
                className="h-5 w-5 accent-cyan-500"
              />
            </label>

            <button
              type="button"
              onClick={() => void calculateRoutes()}
              disabled={busy}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 py-4 font-semibold"
            >
              <Navigation size={18} />
              {busy
                ? "Finding best routes..."
                : "Find Traffic-Aware Routes"}
            </button>

            {routes.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold">Available routes</h3>

                <div className="mt-3 space-y-3">
                  {routes.map((route, index) => {
                    const selected =
                      route.id === selectedRoute?.id;

                    return (
                      <button
                        key={route.id}
                        onClick={() => setSelectedRoute(route)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          selected
                            ? "border-blue-400/40 bg-blue-500/10"
                            : "border-white/10 bg-white/[0.03]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">
                            {index === 0
                              ? "Fastest route"
                              : `Alternative ${index}`}
                          </span>
                          <span className="text-sm text-cyan-300">
                            {formatMinutes(
                              route.summary.travelTimeSeconds,
                            )}
                          </span>
                        </div>

                        <div className="mt-3 flex gap-4 text-xs text-slate-400">
                          <span>
                            {(
                              route.summary.lengthMeters / 1000
                            ).toFixed(1)}{" "}
                            km
                          </span>
                          <span>
                            Traffic delay:{" "}
                            {Math.round(
                              route.summary.trafficDelaySeconds / 60,
                            )}{" "}
                            min
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedRoute && destination && (
              <div className="mt-5 grid grid-cols-2 gap-3">
                {!live.tracking ? (
                  <button
                    onClick={() =>
                      live.start(selectedRoute, destination)
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 font-semibold text-slate-950"
                  >
                    <PlayCircle size={18} />
                    Start Navigation
                  </button>
                ) : (
                  <button
                    onClick={live.stop}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 py-3 font-semibold"
                  >
                    <PauseCircle size={18} />
                    Stop
                  </button>
                )}

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                  <p className="text-xs text-slate-500">
                    Live status
                  </p>
                  <p className="mt-1 text-sm font-semibold text-emerald-300">
                    {live.rerouting
                      ? "Rerouting..."
                      : live.tracking
                        ? "Tracking"
                        : "Ready"}
                  </p>
                </div>
              </div>
            )}

            {selectedRoute && (
              <button
                type="button"
                onClick={() => void saveCurrentRoute()}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 py-3 text-sm font-semibold text-cyan-200"
              >
                <Bookmark size={16} />
                Save route for offline use
              </button>
            )}

            {savedRoutes.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold">Saved routes</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Stored on this device — they open without a connection.
                </p>

                <div className="mt-3 space-y-2">
                  {savedRoutes.map((route) => (
                    <div
                      key={route.id}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                    >
                      <button
                        type="button"
                        onClick={() => openSavedRoute(route)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <strong className="block truncate text-sm">{route.title}</strong>
                        <span className="mt-1 block text-xs text-slate-500">
                          {(route.distanceMeters / 1000).toFixed(1)} km ·{" "}
                          {formatMinutes(route.durationSeconds)} · {route.travelMode}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${route.title}`}
                        onClick={() => void deleteSavedRoute(route.id)}
                        className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:text-red-300"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {live.tracking && nextInstruction && (
              <div className="mt-5 rounded-[24px] border border-blue-400/20 bg-blue-500/10 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-blue-300">
                  Next direction
                </p>
                <p className="mt-3 text-xl font-bold">
                  {nextInstruction.message}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Continue following the highlighted route.
                </p>
              </div>
            )}

            {activeRoute && (
              <div className="mt-6">
                <h3 className="font-semibold">
                  Turn-by-turn directions
                </h3>
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                  {activeRoute.instructions.map(
                    (instruction, index) => (
                      <div
                        key={instruction.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <p className="text-sm">
                          {index + 1}. {instruction.message}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {instruction.routeOffsetMeters < 1000
                            ? `${Math.round(
                                instruction.routeOffsetMeters,
                              )} m`
                            : `${(
                                instruction.routeOffsetMeters / 1000
                              ).toFixed(1)} km`}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

            <div className="mt-7 border-t border-white/10 pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-amber-400" />
                <h2 className="text-xl font-bold">
                  Traffic & Community
                </h2>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                {incidents.length} traffic incidents and{" "}
                {communityNotes.length} community notes are visible
                in the current map area.
              </p>
            </div>

            <div className="mt-7 border-t border-white/10 pt-6">
              <div className="flex items-center gap-3">
                <Bot className="text-purple-400" />
                <h2 className="text-xl font-bold">Ask Nexus AI</h2>
              </div>

              <div className="mt-4 max-h-44 space-y-2 overflow-y-auto rounded-2xl bg-white/[0.03] p-3 text-xs leading-5 text-slate-400">
                {messages.map((message, index) => (
                  <p key={`${message}-${index}`}>{message}</p>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={question}
                  onChange={(event) =>
                    setQuestion(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") askAi();
                  }}
                  placeholder="Ask about route or traffic..."
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none"
                />
                <button
                  onClick={askAi}
                  className="rounded-xl bg-purple-500 p-3"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </motion.aside>

          <div className="relative min-h-[760px]">
            {/* Scoped boundary: the map talks to a native GL library and to
                third-party data, so it is the most likely thing to throw. If it
                does, the planner, alerts and the rest of the page must keep
                working instead of the whole route going blank. */}
            <ErrorBoundary label="map" inline>
              <MapLibreMap
                start={start}
                destination={destination}
                selectedRoute={activeRoute}
                alternatives={routes}
                // Live tracking wins when it is running; otherwise the one-shot
                // GPS fix drives the "You are here" marker and auto-centring.
                currentLocation={live.current ?? geo.coordinates}
                incidents={incidents}
                communityNotes={communityNotes}
                roadAlerts={roadAlerts}
                showTraffic={showTraffic}
                recenterRequest={recenterRequest}
                onAlertSelect={setSelectedAlert}
                onBoundsChange={handleBoundsChange}
                onRouteSelect={setSelectedRoute}
              />
            </ErrorBoundary>

            <div className="pointer-events-none absolute left-5 top-5 z-[700] rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur-xl">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles size={17} className="text-cyan-400" />
                TomTom live navigation
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Search, traffic, incidents and GPS tracking
              </p>
            </div>

            {/* Route warning banner */}
            <AnimatePresence>
              {alertsOnRoute.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="pointer-events-auto absolute left-1/2 top-4 z-[750] w-[min(440px,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-amber-400/30 bg-amber-500/15 px-4 py-3 backdrop-blur-xl"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="shrink-0 text-amber-300" size={18} />
                    <p className="text-sm text-amber-100">
                      {alertsOnRoute.length} road alert{alertsOnRoute.length > 1 ? "s" : ""} on your route
                    </p>
                    {routes.length > 1 && (
                      <button
                        onClick={recalcAvoidingAlerts}
                        className="ml-auto shrink-0 rounded-lg bg-amber-400/20 px-3 py-1.5 text-xs font-semibold text-amber-100"
                      >
                        Avoid
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Alert detail panel */}
            <AnimatePresence>
              {selectedAlert && (
                <AlertDetailPanel
                  alert={selectedAlert}
                  busy={alertBusy}
                  onClose={() => setSelectedAlert(null)}
                  onConfirm={() => void confirmAlert(selectedAlert.id)}
                  onResolve={() => void resolveAlert(selectedAlert.id)}
                  onAvoid={routes.length > 1 ? recalcAvoidingAlerts : undefined}
                />
              )}
            </AnimatePresence>
          </div>
          </motion.div>
      </div>
    </section>
  );
};

export default MapPage;
