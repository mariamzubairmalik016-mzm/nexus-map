/**
 * The single normalized place shape every search provider is mapped into
 * before ranking, de-duplication or serialization.
 *
 * `lat`/`lng` are the canonical coordinates. `position` is kept alongside them
 * because the existing frontend (SearchAutocomplete, MapPage, offline cache)
 * reads `position.latitude` / `position.longitude` — emitting both keeps the
 * new contract without breaking any current consumer.
 */
export type PlaceProvider = "tomtom" | "geoapify" | "supabase" | "offline";

export type NormalizedPlace = {
  id: string;
  provider: PlaceProvider;
  providerId?: string;
  name: string;
  displayName: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  countryCode?: string;
  category?: string;
  lat: number;
  lng: number;
  score?: number;

  /** Legacy-compatible mirror of lat/lng. Do not remove. */
  position: { latitude: number; longitude: number };
};

/** True only for coordinates that are real, finite and in range. */
export const isValidLatLng = (lat: unknown, lng: unknown): boolean =>
  typeof lat === "number" &&
  typeof lng === "number" &&
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180 &&
  // 0,0 (Null Island) is virtually always a provider error, not a real result.
  !(lat === 0 && lng === 0);

/**
 * Builds a NormalizedPlace, filling `displayName` and the legacy `position`
 * mirror. Returns null when the coordinates are unusable, so callers can drop
 * the result instead of inventing fallback coordinates.
 */
export const toNormalizedPlace = (input: {
  id: string;
  provider: PlaceProvider;
  providerId?: string;
  name?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  countryCode?: string;
  category?: string;
  lat: number;
  lng: number;
  score?: number;
}): NormalizedPlace | null => {
  if (!isValidLatLng(input.lat, input.lng)) return null;

  const name = (input.name ?? "").trim() || input.address?.trim() || "Unknown place";

  // displayName = name + the most useful locality context we have, without
  // repeating the name when the address already starts with it.
  const context = [input.city, input.province, input.country]
    .filter((part): part is string => Boolean(part && part.trim()))
    .filter((part) => part.toLowerCase() !== name.toLowerCase());
  const displayName = context.length ? `${name}, ${context.join(", ")}` : name;

  return {
    id: input.id,
    provider: input.provider,
    providerId: input.providerId,
    name,
    displayName,
    address: input.address,
    city: input.city,
    province: input.province,
    country: input.country,
    countryCode: input.countryCode ? input.countryCode.toUpperCase() : undefined,
    category: input.category,
    lat: input.lat,
    lng: input.lng,
    score: input.score,
    position: { latitude: input.lat, longitude: input.lng },
  };
};
