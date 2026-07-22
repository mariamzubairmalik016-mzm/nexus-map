import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Globe2,
  HardDrive,
  Map,
  Search,
  Trash2,
  WifiOff,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { offlineRegionService } from "../../services/offlineRegionService";
import { getInitialCenter } from "../../config/mapView";
import type { OfflineRegion, RegionBounds } from "../../types/offlineRegion";
import { offlineDb } from "../../services/offlineDb";
import { navigationApi } from "../../services/navigationApi";
import type { OfflinePlace } from "../../types/offline";
import {
  formatBytes,
  getStorageEstimate,
  requestPersistentStorage,
  type StorageEstimateInfo,
} from "../../services/storageManager";

/**
 * Scope -> a bounding box around the resolved point, plus a zoom range.
 * Kept modest deliberately: the OpenStreetMap tile usage policy forbids bulk
 * downloading, and these ranges keep a region to a few hundred tiles.
 */
const SCOPE_PARAMS: Record<string, { halfSpanDegrees: number; minZoom: number; maxZoom: number }> = {
  City: { halfSpanDegrees: 0.08, minZoom: 11, maxZoom: 15 },
  District: { halfSpanDegrees: 0.2, minZoom: 10, maxZoom: 14 },
  "Province / State": { halfSpanDegrees: 1.0, minZoom: 8, maxZoom: 11 },
  Country: { halfSpanDegrees: 3.0, minZoom: 6, maxZoom: 9 },
};

const boundsAround = (latitude: number, longitude: number, halfSpan: number): RegionBounds => ({
  north: Math.min(85, latitude + halfSpan),
  south: Math.max(-85, latitude - halfSpan),
  east: Math.min(180, longitude + halfSpan),
  west: Math.max(-180, longitude - halfSpan),
});

const formatMb = (bytes: number) => `${Math.max(0.1, bytes / 1024 / 1024).toFixed(1)} MB`;

const regionCenter = (region: OfflineRegion) => ({
  latitude: (region.bounds.north + region.bounds.south) / 2,
  longitude: (region.bounds.east + region.bounds.west) / 2,
});

const OfflineMaps = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("City");
  const [areas, setAreas] = useState<OfflineRegion[]>([]);
  const [storage, setStorage] = useState<StorageEstimateInfo | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<OfflinePlace[]>([]);

  const refreshStorage = async () => {
    try {
      setStorage(await getStorageEstimate());
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void offlineRegionService.list().then(setAreas);
    void requestPersistentStorage();
    void refreshStorage();
  }, []);

  /**
   * Size preview for the selected scope, computed at the map's current view so
   * the numbers reflect roughly where the user is looking. The real count is
   * recomputed against the resolved place before anything downloads.
   */
  const scopeEstimate = useMemo(() => {
    const params = SCOPE_PARAMS[scope] ?? SCOPE_PARAMS.City;
    const center = getInitialCenter();
    return offlineRegionService.estimate(
      boundsAround(center.latitude, center.longitude, params.halfSpanDegrees),
      params.minZoom,
      params.maxZoom,
    );
  }, [scope]);

  const upsertArea = (area: OfflineRegion) =>
    setAreas((prev) =>
      prev.some((a) => a.id === area.id) ? prev.map((a) => (a.id === area.id ? area : a)) : [area, ...prev],
    );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) {
      toast.error("Enter any country, city or area.");
      return;
    }
    if (!("caches" in window)) {
      toast.error("Offline maps are not supported in this browser.");
      return;
    }

    const name = query.trim();
    const params = SCOPE_PARAMS[scope] ?? SCOPE_PARAMS.City;
    const toastId = toast.loading(`Finding ${name}…`);

    // Resolve ANY worldwide place via the search provider — no Pakistan fallback.
    let coordinates: { latitude: number; longitude: number };
    try {
      const matches = await navigationApi.search(name);
      const first = matches[0];
      if (!first) {
        toast.error(`Could not find “${name}”. Try a more specific place name.`, { id: toastId });
        return;
      }
      coordinates = { latitude: first.position.latitude, longitude: first.position.longitude };
    } catch {
      toast.error("Location search needs an internet connection.", { id: toastId });
      return;
    }

    const bounds = boundsAround(coordinates.latitude, coordinates.longitude, params.halfSpanDegrees);
    const estimate = offlineRegionService.estimate(bounds, params.minZoom, params.maxZoom);

    if (estimate.tooLarge) {
      toast.error(
        `That area needs ${estimate.tileCount.toLocaleString()} tiles. Choose a smaller scope.`,
        { id: toastId },
      );
      return;
    }

    setQuery("");
    toast.loading(
      `Downloading ${name} — ${estimate.tileCount.toLocaleString()} tiles (~${formatMb(estimate.sizeBytes)})…`,
      { id: toastId },
    );

    try {
      const region = await offlineRegionService.download(
        { name, bounds, minZoom: params.minZoom, maxZoom: params.maxZoom },
        upsertArea,
      );

      // Make the downloaded location searchable offline.
      await offlineDb.savePlaces([
        {
          id: `region-${region.id}`,
          packId: region.id,
          name,
          category: "Downloaded area",
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        },
      ]);

      setAreas(await offlineRegionService.list());
      await refreshStorage();

      if (region.status === "downloaded") {
        toast.success(`${name} is available offline.`, { id: toastId });
      } else if (region.status === "paused") {
        toast(`${name} paused.`, { id: toastId, icon: "⏸️" });
      } else {
        toast.error(`Could not download ${name}.`, { id: toastId });
      }
    } catch (error) {
      setAreas(await offlineRegionService.list());
      toast.error(error instanceof Error ? error.message : `Could not download ${name}.`, { id: toastId });
    }
  };

  const pauseArea = (id: string) => {
    offlineRegionService.pause(id);
    toast("Pausing after the current batch…", { icon: "⏸️" });
  };

  /** Re-downloads a region so its tiles reflect the current map data. */
  const updateArea = async (region: OfflineRegion) => {
    const toastId = toast.loading(`Updating ${region.name}…`);
    try {
      offlineRegionService.resumeFlagCleared(region.id);
      await offlineRegionService.download(
        {
          id: region.id,
          name: region.name,
          bounds: region.bounds,
          minZoom: region.minZoom,
          maxZoom: region.maxZoom,
        },
        upsertArea,
      );
      setAreas(await offlineRegionService.list());
      await refreshStorage();
      toast.success(`${region.name} updated.`, { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed.", { id: toastId });
    }
  };

  const removeArea = async (id: string) => {
    await offlineRegionService.remove(id);
    setAreas(await offlineRegionService.list());
    await refreshStorage();
  };

  const openMap = (area: OfflineRegion) => {
    const center = regionCenter(area);
    navigate(
      `/map?place=${encodeURIComponent(area.name)}&lat=${center.latitude}&lng=${center.longitude}`,
    );
  };

  const runSearch = async (value: string) => {
    setSearchQuery(value);
    setResults(value.trim() ? await offlineDb.searchPlaces(value) : []);
  };

  return (
    <section className="min-h-[calc(100vh-80px)] px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[.25em] text-cyan-400">Worldwide offline navigation</p>
            <h1 className="mt-3 text-4xl font-bold">Download any location</h1>
            <p className="mt-4 max-w-2xl text-slate-400">
              Download real map tiles for a location and open that exact area on the map — even with no connection.
            </p>
          </div>

          <div className="min-w-[220px] rounded-2xl border border-white/10 bg-white/5 p-5">
            <HardDrive className="text-cyan-400" />
            {storage?.supported ? (
              <>
                <p className="mt-3 font-semibold">
                  {formatBytes(storage.usageBytes)} used
                  <span className="text-slate-400"> · {formatBytes(storage.quotaBytes)}</span>
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-cyan-500" style={{ width: `${storage.percent}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {areas.length} area{areas.length === 1 ? "" : "s"} · {storage.persisted ? "persistent" : "best-effort"} storage
                </p>
              </>
            ) : (
              <p className="mt-3">{areas.length} offline areas</p>
            )}
          </div>
        </div>

        <div className="mt-9 grid gap-7 lg:grid-cols-[420px_1fr]">
          <div className="space-y-6">
            <form onSubmit={submit} className="rounded-[30px] border border-white/10 bg-white/[.04] p-6">
              <div className="flex items-center gap-3">
                <Globe2 className="text-cyan-400" />
                <h2 className="text-2xl font-bold">Custom map download</h2>
              </div>

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Any city worldwide — London, Tokyo, Dubai, Hunza..."
                className="mt-6 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 outline-none"
              />

              <select
                value={scope}
                onChange={(event) => setScope(event.target.value)}
                className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4"
              >
                <option>City</option>
                <option>District</option>
                <option>Province / State</option>
                <option>Country</option>
              </select>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Approx. {scopeEstimate.tileCount.toLocaleString()} tiles ·{" "}
                {formatMb(scopeEstimate.sizeBytes)} at zoom {SCOPE_PARAMS[scope]?.minZoom}–
                {SCOPE_PARAMS[scope]?.maxZoom}. The exact count depends on where the place is.
                {scopeEstimate.large && !scopeEstimate.tooLarge && (
                  <span className="mt-1 block text-amber-300">
                    This is a large download — it may take a while.
                  </span>
                )}
                {scopeEstimate.tooLarge && (
                  <span className="mt-1 block text-red-300">
                    Too large to download. Pick a smaller scope.
                  </span>
                )}
              </p>

              <button
                disabled={scopeEstimate.tooLarge}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 py-4 font-semibold text-slate-950 disabled:opacity-50"
              >
                <Download size={19} />
                Download this area
              </button>
            </form>

            <div className="rounded-[30px] border border-white/10 bg-white/[.04] p-6">
              <div className="flex items-center gap-3">
                <Search className="text-cyan-400" />
                <h2 className="text-2xl font-bold">Offline search</h2>
              </div>
              <input
                value={searchQuery}
                onChange={(event) => runSearch(event.target.value)}
                placeholder="Search your downloaded places..."
                className="mt-6 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 outline-none"
              />
              <div className="mt-4 space-y-2">
                {results.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() =>
                      navigate(
                        `/map?place=${encodeURIComponent(place.name)}&lat=${place.latitude}&lng=${place.longitude}`,
                      )
                    }
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-left text-sm"
                  >
                    <span>
                      <span className="font-medium">{place.name}</span>
                      <span className="block text-xs text-slate-500">{place.category}</span>
                    </span>
                    <ExternalLink size={15} className="text-cyan-400" />
                  </button>
                ))}
                {searchQuery.trim() && results.length === 0 && (
                  <p className="text-sm text-slate-500">No offline places match “{searchQuery}”.</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-bold">Your offline maps</h2>

            <div className="mt-6 space-y-4">
              {areas.map((area) => {
                const downloaded = area.status === "downloaded";
                return (
                  <article key={area.id} className="rounded-[26px] border border-white/10 bg-white/[.04] p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex gap-4">
                        <div className="rounded-2xl bg-purple-400/10 p-3 text-purple-400">
                          <Map />
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{area.name}</h3>
                            {downloaded && <CheckCircle2 className="text-emerald-400" size={17} />}
                            {area.status === "failed" && <span className="text-xs text-red-300">failed</span>}
                          </div>

                          <p className="mt-1 text-sm text-slate-400">
                            {area.downloadedTileCount.toLocaleString()} / {area.tileCount.toLocaleString()} tiles ·{" "}
                            {formatMb(area.sizeBytes)} · z{area.minZoom}–{area.maxZoom}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Updated {new Date(area.updatedAt).toLocaleString()} · v{area.version} · {area.provider}
                          </p>

                          {area.status === "downloading" && (
                            <div className="mt-3">
                              <div className="h-2 w-60 overflow-hidden rounded-full bg-white/10">
                                <div
                                  className="h-full bg-cyan-500 transition-all"
                                  style={{
                                    width: `${Math.round((area.downloadedTileCount / Math.max(1, area.tileCount)) * 100)}%`,
                                  }}
                                />
                              </div>
                              <p className="mt-1 text-xs text-slate-500">
                                {Math.round((area.downloadedTileCount / Math.max(1, area.tileCount)) * 100)}%
                              </p>
                            </div>
                          )}

                          {area.status === "paused" && (
                            <p className="mt-2 text-xs text-amber-300">Paused — use Update to finish it.</p>
                          )}
                          {area.lastError && <p className="mt-2 text-xs text-red-300">{area.lastError}</p>}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {downloaded && (
                          <button
                            type="button"
                            onClick={() => openMap(area)}
                            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950"
                          >
                            <ExternalLink size={17} />
                            Open Map
                          </button>
                        )}

                        {area.status === "downloading" ? (
                          <button
                            type="button"
                            onClick={() => pauseArea(area.id)}
                            className="rounded-xl bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-200"
                          >
                            Pause
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => void updateArea(area)}
                              className="rounded-xl bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200"
                            >
                              Update
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${area.name}`}
                              onClick={() => removeArea(area.id)}
                              className="rounded-xl bg-red-400/10 p-3 text-red-300"
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {areas.length === 0 && (
              <div className="mt-6 rounded-[28px] border border-dashed border-white/10 p-16 text-center">
                <WifiOff className="mx-auto text-slate-600" />
                <p className="mt-3 text-sm text-slate-500">No offline maps yet. Download a location to get started.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default OfflineMaps;
