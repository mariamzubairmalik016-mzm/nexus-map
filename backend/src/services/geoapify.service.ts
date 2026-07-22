import { env } from "../config/env.js";
import { toNormalizedPlace, type NormalizedPlace } from "../types/place.js";

export const geoapifyConfigured = Boolean(env.GEOAPIFY_API_KEY);

const GEOAPIFY_URL = "https://api.geoapify.com/v1/geocode/search";

type GeoapifyResult = {
  place_id?: string;
  name?: string;
  formatted?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  country?: string;
  country_code?: string;
  lon: number;
  lat: number;
  result_type?: string;
  category?: string;
  rank?: { confidence?: number };
};

/**
 * Supplementary geocoder with strong OSM-based POI coverage (used for the
 * Pakistani malls / institutes TomTom lacks, and as a fallback when TomTom
 * returns nothing useful anywhere in the world).
 *
 * The API key stays server-side. Returns [] gracefully when the key is missing
 * or the request fails — it never throws to the caller, so a Geoapify outage
 * cannot take down search.
 */
export const searchGeoapify = async (
  query: string,
  lat?: number,
  lon?: number,
  countryCode?: string, // ISO2, e.g. "pk". Omit for a worldwide fallback pass.
): Promise<NormalizedPlace[]> => {
  if (!env.GEOAPIFY_API_KEY || query.trim().length < 2) return [];

  const params = new URLSearchParams({
    text: query.trim(),
    limit: "8",
    format: "json",
    apiKey: env.GEOAPIFY_API_KEY,
  });
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    params.set("bias", `proximity:${lon},${lat}`);
  }
  if (countryCode) params.set("filter", `countrycode:${countryCode.toLowerCase()}`);

  try {
    const response = await fetch(`${GEOAPIFY_URL}?${params.toString()}`);
    if (!response.ok) {
      // Status only — never log the URL, it carries the API key.
      console.error(`[geoapify] search failed with status ${response.status}`);
      return [];
    }
    const json = (await response.json()) as { results?: GeoapifyResult[] };

    return (json.results ?? [])
      .map((result) =>
        toNormalizedPlace({
          id: `geoapify-${result.place_id ?? `${result.lat},${result.lon}`}`,
          provider: "geoapify",
          providerId: result.place_id,
          name: result.name || result.address_line1 || result.formatted,
          address: result.formatted || [result.city, result.country].filter(Boolean).join(", "),
          city: result.city,
          province: result.state,
          country: result.country,
          countryCode: result.country_code,
          category: result.result_type || result.category,
          // Geoapify confidence is already 0..1 — the same scale as the
          // normalized TomTom relevance.
          score: result.rank?.confidence ?? 0.5,
          lat: result.lat,
          lng: result.lon,
        }),
      )
      .filter((place): place is NormalizedPlace => place !== null);
  } catch {
    console.error("[geoapify] request error");
    return [];
  }
};
