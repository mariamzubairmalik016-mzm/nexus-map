import { useEffect, useState, type FormEvent } from "react";
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

import { offlineTileService, type OfflineArea } from "../../services/offlineTileService";
import { offlineDb } from "../../services/offlineDb";
import { navigationApi } from "../../services/navigationApi";
import type { OfflinePlace } from "../../types/offline";
import {
  formatBytes,
  getStorageEstimate,
  requestPersistentStorage,
  type StorageEstimateInfo,
} from "../../services/storageManager";

// Scope -> zoom range + tile radius. Kept modest to respect OSM tile usage and
// keep downloads fast.
const SCOPE_PARAMS: Record<string, { zoomMin: number; zoomMax: number; radiusTiles: number }> = {
  City: { zoomMin: 11, zoomMax: 14, radiusTiles: 2 },
  District: { zoomMin: 11, zoomMax: 14, radiusTiles: 3 },
  "Province / State": { zoomMin: 8, zoomMax: 12, radiusTiles: 3 },
  Country: { zoomMin: 6, zoomMax: 10, radiusTiles: 3 },
};

const approxSizeMb = (tileCount: number) => Math.max(1, Math.round(tileCount * 0.02));

const OfflineMaps = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("City");
  const [areas, setAreas] = useState<OfflineArea[]>([]);
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
    setAreas(offlineTileService.getAreas());
    void requestPersistentStorage();
    void refreshStorage();
  }, []);

  const upsertArea = (area: OfflineArea) =>
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

    setQuery("");
    toast.loading(`Downloading ${name}…`, { id: toastId });

    try {
      await offlineTileService.downloadArea(
        { name, latitude: coordinates.latitude, longitude: coordinates.longitude, ...params },
        (area) => upsertArea(area),
      );
      // Make the downloaded location searchable offline.
      await offlineDb.savePlaces([
        {
          id: crypto.randomUUID(),
          packId: name,
          name,
          category: "Downloaded area",
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        },
      ]);
      setAreas(offlineTileService.getAreas());
      await refreshStorage();
      toast.success(`${name} is available offline.`, { id: toastId });
    } catch {
      setAreas(offlineTileService.getAreas());
      toast.error(`Could not download ${name}. Check your connection.`, { id: toastId });
    }
  };

  const removeArea = async (id: string) => {
    await offlineTileService.removeArea(id);
    setAreas(offlineTileService.getAreas());
    await refreshStorage();
  };

  const openMap = (area: OfflineArea) => {
    navigate(`/map?place=${encodeURIComponent(area.name)}&lat=${area.latitude}&lng=${area.longitude}`);
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

              <button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 py-4 font-semibold text-slate-950">
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
                            {area.tileCount} tiles · ~{approxSizeMb(area.tileCount)} MB
                          </p>

                          {area.status === "downloading" && (
                            <div className="mt-3">
                              <div className="h-2 w-60 overflow-hidden rounded-full bg-white/10">
                                <div className="h-full bg-cyan-500 transition-all" style={{ width: `${area.progress}%` }} />
                              </div>
                              <p className="mt-1 text-xs text-slate-500">{area.progress}%</p>
                            </div>
                          )}
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

                        {area.status !== "downloading" && (
                          <button
                            type="button"
                            onClick={() => removeArea(area.id)}
                            className="rounded-xl bg-red-400/10 p-3 text-red-300"
                          >
                            <Trash2 size={18} />
                          </button>
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
