import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Bot,
  Car,
  Clock3,
  LocateFixed,
  MapPin,
  Navigation,
  PauseCircle,
  PlayCircle,
  Route,
  Send,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";

import SearchAutocomplete from "../../components/map/SearchAutocomplete";
import NavigationMap from "../../components/map/NavigationMap";
import { AnimatePresence, motion } from "framer-motion";

import { navigationApi } from "../../services/navigationApi";
import { offlineDb } from "../../services/offlineDb";
import { roadAlertsService } from "../../services/roadAlertsService";
import AlertDetailPanel from "../../components/map/AlertDetailPanel";
import { useLiveNavigation } from "../../hooks/useLiveNavigation";
import { useGeolocation } from "../../hooks/useGeolocation";
import type { RoadAlert } from "../../types/roadAlerts";

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

const MapPage = () => {
  const [searchParams] = useSearchParams();
  const [startText, setStartText] = useState("");
  const [destinationText, setDestinationText] = useState("");
  const [start, setStart] = useState<Coordinates | null>(null);
  const [destination, setDestination] =
    useState<Coordinates | null>(null);
  const [routes, setRoutes] = useState<RouteAlternative[]>([]);
  const [selectedRoute, setSelectedRoute] =
    useState<RouteAlternative | null>(null);
  const [incidents, setIncidents] = useState<TrafficIncident[]>([]);
  const [communityNotes, setCommunityNotes] =
    useState<CommunityNote[]>([]);
  const [busy, setBusy] = useState(false);
  const [avoidTolls, setAvoidTolls] = useState(false);
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

  // GPS button: use the browser Geolocation API directly (no tracking mode
  // required). When a fix arrives, set it as the start point.
  useEffect(() => {
    if (geo.coordinates) {
      setStart({
        latitude: geo.coordinates.latitude,
        longitude: geo.coordinates.longitude,
        accuracy: geo.coordinates.accuracy,
      });
      setStartText("Current Location");
    }
  }, [geo.coordinates]);

  useEffect(() => {
    if (geo.error) toast.error("Unable to access your location — please allow location permission.");
  }, [geo.error]);

  const loadAlerts = useCallback(async () => {
    try {
      const { alerts } = await roadAlertsService.list({ status: "active" });
      setRoadAlerts(alerts);
    } catch {
      /* keep previous alerts */
    }
  }, []);

  useEffect(() => {
    void loadAlerts();
    const unsubscribe = roadAlertsService.subscribeRealtime(() => void loadAlerts());
    const timer = window.setInterval(() => void loadAlerts(), 45_000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [loadAlerts]);

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
      setDestinationText(place);
      setDestination({ latitude, longitude });
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

    try {
      setBusy(true);
      const result = await navigationApi.routes(start, destination, {
        travelMode: "car",
        avoidTolls,
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
        startName: startText || "Start",
        destinationName: destinationText || "Destination",
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

  const handleBoundsChange = useCallback(
    (bounds: Bounds) => {
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

        <div className="grid overflow-hidden rounded-[34px] border border-white/10 bg-[#050816] shadow-2xl xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="max-h-[920px] overflow-y-auto border-b border-white/10 p-5 xl:border-b-0 xl:border-r">
            <div className="flex items-center gap-3">
              <Route className="text-purple-400" />
              <h2 className="text-2xl font-bold">
                Smart Route Planner
              </h2>
            </div>

            <div className="mt-5 space-y-4">
              <SearchAutocomplete
                label="Starting point"
                value={startText}
                placeholder="Your location or any place"
                bias={geo.coordinates ?? live.current}
                onChange={(value) => {
                  setStartText(value);
                  setStart(null);
                }}
                onSelect={(item: SearchSuggestion) =>
                  setStart(item.position)
                }
                accent="emerald"
              />

              <button
                type="button"
                onClick={() => geo.getCurrentLocation()}
                disabled={geo.loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-sm disabled:opacity-60"
              >
                <LocateFixed size={17} />
                {geo.loading ? "Locating…" : "Use current GPS location"}
              </button>

              <SearchAutocomplete
                label="Destination"
                value={destinationText}
                placeholder="Street, village, city or landmark"
                bias={geo.coordinates ?? live.current}
                onChange={(value) => {
                  setDestinationText(value);
                  setDestination(null);
                }}
                onSelect={(item: SearchSuggestion) =>
                  setDestination(item.position)
                }
                accent="red"
              />
            </div>

            <label className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
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
          </aside>

          <div className="relative min-h-[760px]">
            <NavigationMap
              start={start}
              destination={destination}
              selectedRoute={activeRoute}
              alternatives={routes}
              currentLocation={live.current}
              incidents={incidents}
              communityNotes={communityNotes}
              roadAlerts={roadAlerts}
              showTraffic={showTraffic}
              onAlertSelect={setSelectedAlert}
              onBoundsChange={handleBoundsChange}
              onRouteSelect={setSelectedRoute}
            />

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
        </div>
      </div>
    </section>
  );
};

export default MapPage;
