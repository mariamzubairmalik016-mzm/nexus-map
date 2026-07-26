import { appEnv } from "../config/appEnv";
import { networkStatus } from "./networkStatus";
import { offlineDb } from "./offlineDb";
import type { OfflinePlace } from "../types/offline";
import type { RecentSearch, SavedPlace, SearchSuggestion } from "../types/navigation";
import { searchGeoCatalog } from "./geoCatalog.service";

/**
 * Place search for the UI.
 *
 * Online  -> backend (TomTom primary + Geoapify supplementary), result cached.
 * Offline -> saved places, recent searches, cached results and downloaded
 *            offline places. No provider is ever contacted while offline.
 */

const MIN_QUERY_LENGTH = 2;
const CACHE_LIMIT = 60;
const RECENT_LIMIT = 12;

/** UI labels that are not real places and must never reach a provider. */
const NON_SEARCHABLE = new Set(["current location", "my location", "your location"]);

export const isSearchableQuery = (query: string) => {
  const clean = query.trim().toLowerCase();
  return clean.length >= MIN_QUERY_LENGTH && !NON_SEARCHABLE.has(clean);
};

const cacheKey = (query: string) => `q:${query.trim().toLowerCase()}`;

type CachedSearch = { id: string; query: string; results: SearchSuggestion[]; cachedAt: string };

export const savedPlaceToSuggestion = (place: SavedPlace): SearchSuggestion => ({
  id: `saved-${place.id}`,
  provider: "saved",
  name: place.label || place.name,
  displayName: place.name,
  address: place.address ?? place.name,
  lat: place.latitude,
  lng: place.longitude,
  position: { latitude: place.latitude, longitude: place.longitude },
});

const recentToSuggestion = (item: RecentSearch): SearchSuggestion => ({
  id: `recent-${item.id}`,
  provider: item.provider ?? "offline",
  name: item.name,
  displayName: item.displayName,
  address: item.address ?? item.displayName,
  lat: item.latitude,
  lng: item.longitude,
  position: { latitude: item.latitude, longitude: item.longitude },
});

const offlinePlaceToSuggestion = (place: OfflinePlace): SearchSuggestion => ({
  id: `offline-${place.id}`,
  provider: "offline",
  name: place.name,
  displayName: place.address ? `${place.name}, ${place.address}` : place.name,
  address: place.address ?? place.category,
  category: place.category,
  lat: place.latitude,
  lng: place.longitude,
  position: { latitude: place.latitude, longitude: place.longitude },
});

const matches = (haystack: string, needle: string) => haystack.toLowerCase().includes(needle);

/** Everything searchable without a network connection. */
const searchLocal = async (query: string): Promise<SearchSuggestion[]> => {
  const needle = query.trim().toLowerCase();

  const [savedPlaces, recents, cached, offlinePlaces] = await Promise.all([
    offlineDb.getSavedPlaces().catch(() => [] as SavedPlace[]),
    offlineDb.getRecentSearches().catch(() => [] as RecentSearch[]),
    offlineDb.getCachedSearches<CachedSearch>().catch(() => [] as CachedSearch[]),
    offlineDb.searchPlaces(query).catch(() => [] as OfflinePlace[]),
  ]);

  const fromSaved = savedPlaces
    .filter((place) => !place.deleted)
    .filter((place) => matches(`${place.label} ${place.name} ${place.address ?? ""}`, needle))
    .map(savedPlaceToSuggestion);

  const fromRecents = recents
    .filter((item) => matches(`${item.name} ${item.displayName} ${item.query}`, needle))
    .sort((a, b) => b.searchedAt.localeCompare(a.searchedAt))
    .map(recentToSuggestion);

  // An exact cache hit for this query, plus any cached result that matches.
  const exact = cached.find((entry) => entry.id === cacheKey(query));
  const fromCache = exact
    ? exact.results
    : cached.flatMap((entry) => entry.results).filter((result) => matches(result.name, needle));

  const fromOffline = offlinePlaces.map(offlinePlaceToSuggestion);

  // Saved places first, then recents, then cached/downloaded data.
  const merged = [...fromSaved, ...fromRecents, ...fromCache, ...fromOffline];

  const seen = new Set<string>();
  return merged
    .filter((item) => {
      const key = `${item.name.toLowerCase()}|${item.position.latitude.toFixed(3)}|${item.position.longitude.toFixed(3)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
};

const cacheResults = async (query: string, results: SearchSuggestion[]) => {
  if (!results.length) return;
  try {
    await offlineDb.saveCachedSearch<CachedSearch>({
      id: cacheKey(query),
      query: query.trim(),
      results,
      cachedAt: new Date().toISOString(),
    });

    // Keep the cache bounded — drop the oldest entries beyond the limit.
    const all = await offlineDb.getCachedSearches<CachedSearch>();
    if (all.length > CACHE_LIMIT) {
      const stale = all.sort((a, b) => a.cachedAt.localeCompare(b.cachedAt)).slice(0, all.length - CACHE_LIMIT);
      await Promise.all(stale.map((entry) => offlineDb.deleteCachedSearch(entry.id).catch(() => undefined)));
    }
  } catch {
    /* caching is best-effort */
  }
};

export type SearchOutcome = {
  results: SearchSuggestion[];
  /** True when the results came from local storage rather than a provider. */
  offline: boolean;
};

/**
 * Runs a search. `signal` lets the caller abort a stale in-flight request.
 * Throws only on a genuine online failure, so the UI can show an error state.
 */
export const searchPlaces = async (
  query: string,
  bias?: { latitude: number; longitude: number } | null,
  signal?: AbortSignal,
): Promise<SearchOutcome> => {
  if (!isSearchableQuery(query)) return { results: [], offline: networkStatus.isOffline() };

  if (networkStatus.isOffline()) {
    return { results: await searchLocal(query), offline: true };
  }

  const params = new URLSearchParams({ q: query.trim() });
  if (bias && Number.isFinite(bias.latitude) && Number.isFinite(bias.longitude)) {
    params.set("lat", String(bias.latitude));
    params.set("lon", String(bias.longitude));
  }

  const response = await fetch(`${appEnv.apiUrl}/navigation/search?${params.toString()}`, { signal });

  if (!response.ok) {
    throw new Error(`Search failed (${response.status})`);
  }

  const payload = (await response.json()) as { success: boolean; data: SearchSuggestion[]; message?: string };
  if (!payload.success) throw new Error(payload.message || "Search failed.");

  // Also search our curated catalog so we always find known cities
  const catalogResults = await searchGeoCatalog(query, 5).catch(() => []);
  const catalogSuggestions: SearchSuggestion[] = catalogResults.map(cat => ({
    id: cat.id,
    provider: "catalog",
    name: cat.name,
    displayName: cat.name,
    address: cat.address,
    category: cat.category,
    lat: cat.position.latitude,
    lng: cat.position.longitude,
    position: cat.position
  }));

  // Merge, putting catalog matches first
  const mergedResults = [...catalogSuggestions, ...(payload.data ?? [])];
  
  // Deduplicate by name/location
  const seen = new Set<string>();
  const results = mergedResults.filter(item => {
    const key = `${item.name.toLowerCase()}|${item.position.latitude.toFixed(2)}|${item.position.longitude.toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  void cacheResults(query, results);
  return { results, offline: false };
};

/** Records a selection so it can be offered again later, including offline. */
export const rememberSearch = async (query: string, suggestion: SearchSuggestion) => {
  try {
    const entry: RecentSearch = {
      id: `${suggestion.name}|${suggestion.position.latitude.toFixed(4)}|${suggestion.position.longitude.toFixed(4)}`.toLowerCase(),
      query: query.trim(),
      name: suggestion.name,
      displayName: suggestion.displayName ?? suggestion.name,
      address: suggestion.address,
      latitude: suggestion.position.latitude,
      longitude: suggestion.position.longitude,
      provider: suggestion.provider,
      searchedAt: new Date().toISOString(),
    };
    await offlineDb.addRecentSearch(entry);

    const all = await offlineDb.getRecentSearches();
    if (all.length > RECENT_LIMIT) {
      const stale = all.sort((a, b) => a.searchedAt.localeCompare(b.searchedAt)).slice(0, all.length - RECENT_LIMIT);
      await Promise.all(stale.map((item) => offlineDb.deleteRecentSearch(item.id).catch(() => undefined)));
    }
  } catch {
    /* remembering a search is best-effort */
  }
};

/** Suggestions shown before the user types: saved places, then recents. */
export const getIdleSuggestions = async (): Promise<SearchSuggestion[]> => {
  const [savedPlaces, recents] = await Promise.all([
    offlineDb.getSavedPlaces().catch(() => [] as SavedPlace[]),
    offlineDb.getRecentSearches().catch(() => [] as RecentSearch[]),
  ]);

  return [
    ...savedPlaces.filter((place) => !place.deleted).map(savedPlaceToSuggestion),
    ...recents.sort((a, b) => b.searchedAt.localeCompare(a.searchedAt)).map(recentToSuggestion),
  ].slice(0, 8);
};
