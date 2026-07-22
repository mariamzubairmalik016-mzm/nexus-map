import { env } from "../config/env.js";

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

export type SupplementaryResult = {
  id: string;
  name: string;
  address: string;
  city?: string;
  province?: string;
  country?: string;
  countryCode?: string;
  category?: string;
  score?: number;
  position: { latitude: number; longitude: number };
  source: "geoapify";
};

/**
 * Supplementary geocoder with strong OSM-based POI coverage (used for Pakistan
 * POIs TomTom lacks). The API key stays server-side. Returns [] gracefully when
 * the key is missing or the request fails — never throws to the caller.
 */
export const searchGeoapify = async (
  query: string,
  lat?: number,
  lon?: number,
  countrySet?: string, // ISO2, e.g. "pk"
): Promise<SupplementaryResult[]> => {
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
  if (countrySet) params.set("filter", `countrycode:${countrySet.toLowerCase()}`);

  try {
    const response = await fetch(`${GEOAPIFY_URL}?${params.toString()}`);
    if (!response.ok) {
      console.error(`[geoapify] search failed with status ${response.status}`);
      return [];
    }
    const json = (await response.json()) as { results?: GeoapifyResult[] };
    return (json.results ?? [])
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon))
      .map((r) => ({
        id: `geoapify-${r.place_id ?? `${r.lat},${r.lon}`}`,
        name: r.name || r.address_line1 || r.formatted || "Unknown place",
        address: r.formatted || [r.city, r.country].filter(Boolean).join(", "),
        city: r.city,
        province: r.state,
        country: r.country,
        countryCode: (r.country_code ?? "").toUpperCase(),
        category: r.result_type || r.category,
        // Geoapify confidence is 0..1 — same scale as TomTom's relevance score.
        score: r.rank?.confidence ?? 0.5,
        position: { latitude: r.lat, longitude: r.lon },
        source: "geoapify" as const,
      }));
  } catch {
    console.error("[geoapify] request error");
    return [];
  }
};
