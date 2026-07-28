/**
 * Geoapify geocoding — local area, street and POI coverage.
 *
 * Added because neither existing provider covers Pakistani neighbourhoods
 * well enough for a destination picker:
 *
 *   TomTom  — no street-level data for Pakistan at all. "Mall Road Lahore",
 *             "Liberty Market Lahore" and "Ferozepur Road Lahore" all return
 *             nothing, and reverse-geocoding Lahore yields "Islamabad".
 *   OSM     — good streets, but Nominatim's public instance is limited to
 *             about one request per second, which is too slow to sit behind
 *             an autocomplete field on its own.
 *
 * Geoapify has an autocomplete endpoint built for exactly this, with
 * proximity bias and a country filter, and it resolves blocks, markets,
 * hospitals and sectors — the granularity people actually type.
 */

const BASE = "https://api.geoapify.com/v1/geocode/autocomplete";

export type GeoapifyPlace = {
  id: string;
  name: string;
  address: string;
  city?: string;
  country?: string;
  category?: string;
  position: { latitude: number; longitude: number };
};

type Feature = {
  properties: {
    place_id?: string;
    name?: string;
    formatted?: string;
    address_line1?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
    result_type?: string;
    category?: string;
    lat: number;
    lon: number;
  };
};

/**
 * @param bias  Proximity bias — results near here rank first. Pass the user's
 *              position, not a configured default; biasing to a default map
 *              centre is what previously returned rural roads for city queries.
 * @param countryCode ISO alpha-2. Matters near borders: Lahore is ~50 km from
 *              India, whose coverage is denser, so unconstrained searches for
 *              Lahore streets surface Amritsar first.
 */
export const searchGeoapify = async (
  query: string,
  bias?: { latitude: number; longitude: number } | null,
  countryCode?: string,
  limit = 8,
): Promise<GeoapifyPlace[]> => {
  const key = process.env.GEOAPIFY_API_KEY;
  const term = query.trim();
  if (!key || term.length < 2) return [];

  const params = new URLSearchParams({
    text: term,
    limit: String(limit),
    lang: "en",
    apiKey: key,
  });

  if (bias && Number.isFinite(bias.latitude) && Number.isFinite(bias.longitude)) {
    params.set("bias", `proximity:${bias.longitude},${bias.latitude}`);
  }
  if (countryCode) params.set("filter", `countrycode:${countryCode.toLowerCase()}`);

  try {
    const response = await fetch(`${BASE}?${params.toString()}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];

    const data = (await response.json()) as { features?: Feature[] };
    const features = Array.isArray(data.features) ? data.features : [];

    return features
      .map((feature): GeoapifyPlace | null => {
        const p = feature.properties;
        if (!Number.isFinite(p?.lat) || !Number.isFinite(p?.lon)) return null;

        // `name` is present for POIs; plain addresses only carry a formatted
        // string, so fall back to its leading segment.
        const name = p.name?.trim() || p.address_line1?.trim() || p.formatted?.split(",")[0]?.trim();
        if (!name) return null;

        return {
          id: `geoapify-${p.place_id ?? `${p.lat},${p.lon}`}`,
          name,
          address: p.formatted || name,
          city: p.city || p.county || p.state,
          country: p.country,
          category: p.category || p.result_type,
          position: { latitude: p.lat, longitude: p.lon },
        };
      })
      .filter((place): place is GeoapifyPlace => place !== null);
  } catch {
    // Timeout, quota, or offline — the other providers still answer.
    return [];
  }
};
