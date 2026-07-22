import type { NormalizedPlace } from "../types/place.js";

/**
 * Ranking for merged multi-provider search results.
 *
 * The required Pakistan order is:
 *   1. exact nearby match
 *   2. exact Karachi / Pakistan match
 *   3. current city
 *   4. current province
 *   5. Pakistan
 *   6. worldwide
 *
 * This is implemented as a composite score rather than hard tiers, because
 * hard tiers break global search: a user sitting in Karachi searching "Tokyo"
 * must get Tokyo, Japan — not a Karachi side-street that happens to match.
 * The weights below are chosen so that NAME EXACTNESS outranks LOCALITY, while
 * locality still decides between results that match the query equally well.
 */

const EARTH_RADIUS_KM = 6371;

export const distanceKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

export const PK_BBOX = { minLat: 23, maxLat: 37, minLon: 60, maxLon: 78 };

export const isInPakistan = (lat?: number, lon?: number) =>
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  (lat as number) >= PK_BBOX.minLat &&
  (lat as number) <= PK_BBOX.maxLat &&
  (lon as number) >= PK_BBOX.minLon &&
  (lon as number) <= PK_BBOX.maxLon;

/** Lowercase, strip punctuation/diacritics and collapse whitespace. */
const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // A leading article is noise: "The Dubai Mall" must match "Dubai Mall".
    .replace(/^the /, "");

/**
 * Words that carry no discriminating power when matching a place name, so
 * "Lucky One Mall Karachi" still matches the POI named "Lucky One Mall".
 */
const STOP_WORDS = new Set(["the", "of", "in", "at", "and", "a", "an"]);

const tokens = (value: string) => normalize(value).split(" ").filter((t) => t && !STOP_WORDS.has(t));

/**
 * 0..1 textual agreement between the query and a candidate name.
 * 1.0 = exact, 0.9 = name is a prefix/superset, then token-recall based.
 */
export const nameMatchScore = (query: string, place: NormalizedPlace): number => {
  const q = normalize(query);
  const name = normalize(place.name);
  const display = normalize(place.displayName);
  if (!q || !name) return 0;

  if (name === q) return 1;
  // "Lucky One Mall Karachi" typed, POI is "Lucky One Mall" in Karachi.
  if (display === q) return 0.97;

  // Searching a city by name: providers return it as "Paris, Île-de-France",
  // so the city field is the reliable signal that this IS the place typed.
  if (place.city && normalize(place.city) === q) return 0.95;

  // The place name is a prefix of the query — the extra words the user typed
  // are context ("Lucky One Mall" + " Karachi"). Scored by how much of the
  // query the name actually covers, because a short generic chain name
  // ("Aptech Learning") must NOT beat the specific branch the user asked for
  // ("Aptech Learning North Nazimabad") just by being a prefix.
  if (q.startsWith(name)) return 0.78 + 0.22 * (name.length / q.length);

  // NOTE: `name.startsWith(q)` deliberately falls through to the tightness
  // branch below. Treating it as near-exact made "Tokyo Terrace" (a Karachi
  // building) rank as an exact match for "Tokyo".
  if (name.includes(q)) {
    // The query is inside a longer name. Prefer the tightest fit, so searching
    // "Dolmen Mall" ranks the mall itself above "Fat Burger - Dolmen Mall".
    const tightness = q.length / name.length;
    // A separator before the matched part means this is a tenant/branch of the
    // searched venue ("Summit Bank - Dolmen Mall Clifton"), rarely what was
    // meant. Tested against the RAW name — `normalize` strips punctuation.
    const rawPrefix = place.name.slice(0, Math.max(0, place.name.toLowerCase().indexOf(q.slice(0, 6))));
    const isTenant = /[-–—,:|@(]/.test(rawPrefix);
    return (0.7 + 0.12 * tightness) * (isTenant ? 0.85 : 1);
  }

  const queryTokens = tokens(query);
  if (!queryTokens.length) return 0;
  const haystack = new Set(tokens(`${place.name} ${place.displayName} ${place.address ?? ""}`));
  const matched = queryTokens.filter((t) => haystack.has(t)).length;
  const recall = matched / queryTokens.length;

  // Full token recall in a longer name (e.g. "aptech learning north nazimabad"
  // inside "Aptech Learning Centre, North Nazimabad") is still a strong match.
  return recall >= 1 ? 0.78 : recall * 0.6;
};

export type RankContext = {
  query: string;
  /** Search bias (usually the user's GPS or map centre). */
  lat?: number;
  lon?: number;
  /** City/province of the bias point, when known. */
  currentCity?: string;
  currentProvince?: string;
};

/** Proximity bonus: strongest under ~5 km, gone past ~250 km. */
const proximityBonus = (place: NormalizedPlace, context: RankContext): number => {
  if (!Number.isFinite(context.lat) || !Number.isFinite(context.lon)) return 0;
  const km = distanceKm(context.lat as number, context.lon as number, place.lat, place.lng);
  if (km <= 5) return 1;
  if (km >= 250) return 0;
  // Smooth decay between 5 km and 250 km.
  return 1 - (km - 5) / 245;
};

/** Locality bonus implementing tiers 3–6 of the required order. */
const localityBonus = (place: NormalizedPlace, context: RankContext, biasInPakistan: boolean): number => {
  const city = normalize(place.city ?? "");
  const province = normalize(place.province ?? "");
  const isPk = place.countryCode === "PK" || normalize(place.country ?? "") === "pakistan";

  if (context.currentCity && city && city === normalize(context.currentCity)) return 1;
  if (context.currentProvince && province && province === normalize(context.currentProvince)) return 0.7;
  if (biasInPakistan && isPk) return 0.45;
  return 0;
};

/**
 * Provider trust. TomTom is the primary provider; Geoapify and the Supabase
 * catalogue are supplementary and get a small handicap so that, all else
 * equal, the primary provider's result is the one shown.
 */
const providerWeight: Record<NormalizedPlace["provider"], number> = {
  tomtom: 1,
  geoapify: 0.94,
  supabase: 0.92,
  offline: 0.85,
};

/**
 * Categories that mark a place as prominent — a settlement, an administrative
 * area or a landmark — as opposed to an ordinary business. This is what stops
 * "Tokyo Electronic" (a shop in Karachi) outranking Tokyo, Japan, and the
 * replica "Eiffel Tower" in Punjab outranking the one in Paris.
 */
const PROMINENT_CATEGORY =
  /important tourist attraction|tourist|monument|geography|capital|city|town|village|suburb|district|municipality|state|province|country|administrative|airport|university|hospital/i;

const prominence = (place: NormalizedPlace) => (PROMINENT_CATEGORY.test(place.category ?? "") ? 1 : 0);

export type RankedPlace = NormalizedPlace & { score: number };

/**
 * Name-match bands. Ranking is band-first: a place whose name actually matches
 * what was typed always outranks one that merely contains the words, no matter
 * how close by it is. This is what keeps worldwide search working while the
 * user's GPS bias sits in Pakistan.
 */
const bandOf = (nameScore: number) => (nameScore >= 0.9 ? 2 : nameScore >= 0.78 ? 1 : 0);

/**
 * Scores one place in [0,1). The integer part of the ranking is the name band;
 * the fraction orders places inside a band by prominence, provider relevance,
 * proximity and locality — which is where the Pakistan priority order
 * (nearby > current city > current province > Pakistan > worldwide) applies.
 */
export const scorePlace = (
  place: NormalizedPlace,
  context: RankContext,
  biasInPakistan: boolean,
  consensus = 0,
): number => {
  const name = nameMatchScore(context.query, place);
  const relevance = Math.max(0, Math.min(1, place.score ?? 0.5));
  const proximity = proximityBonus(place, context);
  const locality = localityBonus(place, context, biasInPakistan);

  const withinBand =
    relevance * 0.3 + prominence(place) * 0.3 + proximity * 0.18 + locality * 0.1 + consensus * 0.12;

  // Band dominates; the within-band score (0..1) only ever breaks ties inside
  // it. Scaled by 0.9 so it can never bridge into the next band.
  return bandOf(name) + withinBand * 0.9 * providerWeight[place.provider];
};

/** Key used to collapse the same real-world place returned by two providers. */
const dedupeKey = (place: NormalizedPlace) =>
  `${normalize(place.name)}|${place.lat.toFixed(3)}|${place.lng.toFixed(3)}`;

/**
 * Merges, de-duplicates and ranks results from every provider.
 * De-duplication keeps the higher-scoring copy, so the primary provider wins
 * ties while a supplementary provider can still supply a place TomTom lacks.
 */
export const rankPlaces = (
  places: NormalizedPlace[],
  context: RankContext,
  limit = 12,
): RankedPlace[] => {
  const biasInPakistan = isInPakistan(context.lat, context.lon);

  /**
   * How many OTHER candidates share this place's name and sit within ~2 km of
   * it. Providers agreeing on where a named place is, is strong evidence it's
   * the real one: the genuine Eiffel Tower comes back as a tight cluster of
   * entries, while a same-named venue in a suburb stands alone.
   */
  const consensusOf = (place: NormalizedPlace) => {
    const name = normalize(place.name);
    const agreeing = places.filter(
      (other) =>
        other !== place &&
        normalize(other.name) === name &&
        distanceKm(place.lat, place.lng, other.lat, other.lng) <= 2,
    ).length;
    return Math.min(1, agreeing / 2);
  };

  const scored = places.map((place) => ({
    ...place,
    score: scorePlace(place, context, biasInPakistan, consensusOf(place)),
  }));

  const unique = new Map<string, RankedPlace>();
  for (const place of scored) {
    const key = dedupeKey(place);
    const existing = unique.get(key);
    if (!existing || place.score > existing.score) unique.set(key, place);
  }

  const sorted = [...unique.values()].sort((a, b) => b.score - a.score);

  // Cap how many results may come from one building. Without this, a mall's
  // eight indexed shop units fill the entire dropdown and hide every other
  // candidate. ~2 decimal places ≈ 1 km.
  const MAX_PER_LOCATION = 2;
  const CROWDING_PENALTY = 0.75;
  const perLocation = new Map<string, number>();

  const spread = sorted.map((place) => {
    const cell = `${place.lat.toFixed(2)}|${place.lng.toFixed(2)}`;
    const used = perLocation.get(cell) ?? 0;
    perLocation.set(cell, used + 1);
    if (used < MAX_PER_LOCATION) return place;
    // Demote inside its own band only — shrink the fractional part and leave
    // the band intact, so a crowded-out exact match still beats a weak one.
    const band = Math.floor(place.score);
    return { ...place, score: band + (place.score - band) * CROWDING_PENALTY };
  });

  return spread.sort((a, b) => b.score - a.score).slice(0, limit);
};

/**
 * True when TomTom's own results are too weak to answer the query, which is
 * when the supplementary provider is worth calling as a fallback.
 */
export const resultsAreWeak = (places: NormalizedPlace[], context: RankContext): boolean => {
  if (places.length === 0) return true;
  const best = Math.max(...places.map((p) => nameMatchScore(context.query, p)));
  return best < 0.8;
};
