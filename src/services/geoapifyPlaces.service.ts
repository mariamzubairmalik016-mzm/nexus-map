/**
 * Live tourism places from Geoapify's Places API.
 *
 * `tourism_pois` holds twelve hand-seeded rows, which is fine as curated
 * content but is not a tourism catalogue — searching any city outside those
 * twelve returned nothing. This fetches hotels, resorts, restaurants,
 * attractions and shopping live, anywhere Geoapify has coverage, and the
 * curated rows stay as a quality layer on top.
 */

const PLACES = "https://api.geoapify.com/v2/places";

/** App-facing category -> Geoapify category codes. */
export const PLACE_CATEGORIES: Record<string, string> = {
  hotel: "accommodation.hotel,accommodation.motel,accommodation.guest_house,accommodation.hostel",
  resort: "accommodation.hotel,leisure.spa,leisure.park",
  restaurant: "catering.restaurant,catering.fast_food,catering.cafe",
  attraction: "tourism.attraction,tourism.sights,entertainment.museum,heritage",
  shopping: "commercial.shopping_mall,commercial.marketplace,commercial.department_store",
  nature: "leisure.park,natural,national_park",
  entertainment: "entertainment,entertainment.culture,entertainment.activity_park",
};

export type LivePlace = {
  id: string;
  name: string;
  category: string;
  description: string;
  shortDescription: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  country: string;
  countryIso2: string;
  imageUrl: string | null;
  rating: number;
  reviewCount: number;
  isVerified: number;
  isFeatured: number;
  tags: string[];
  source: "live";
};

type Feature = {
  properties: {
    place_id?: string;
    name?: unknown;
    formatted?: string;
    address_line2?: string;
    street?: string;
    city?: string;
    town?: string;
    suburb?: string;
    district?: string;
    neighbourhood?: string;
    country?: string;
    country_code?: string;
    categories?: string[];
    website?: string;
    phone?: string;
    lat: number;
    lon: number;
  };
};

/**
 * Coerce a provider field to a trimmed string.
 *
 * Geoapify does not always return `name` as a string — some attraction records
 * carry a localised object instead — and calling `.trim()` on that threw,
 * which the catch turned into an empty result set. Every text field goes
 * through here now rather than being trusted to be a string.
 */
const str = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    // Localised shapes like { en: "...", ur: "..." } — prefer English.
    const record = value as Record<string, unknown>;
    const candidate = record.en ?? Object.values(record).find((v) => typeof v === "string");
    return typeof candidate === "string" ? candidate.trim() : "";
  }
  return "";
};

/** Turn Geoapify's category codes into one readable word. */
const readableCategory = (categories: string[] | undefined, fallback: string): string => {
  const all = (categories || []).join(" ");
  if (/accommodation\.(hotel|motel|resort)/.test(all)) return "hotel";
  if (/accommodation/.test(all)) return "hotel";
  if (/catering\.(restaurant|fast_food)/.test(all)) return "restaurant";
  if (/catering/.test(all)) return "restaurant";
  if (/commercial/.test(all)) return "shopping";
  if (/leisure|natural|national_park/.test(all)) return "nature";
  if (/tourism|heritage|entertainment\.museum/.test(all)) return "attraction";
  if (/entertainment/.test(all)) return "entertainment";
  return fallback;
};

export const fetchLivePlaces = async (input: {
  latitude: number;
  longitude: number;
  category?: string;
  radiusMeters?: number;
  limit?: number;
}): Promise<LivePlace[]> => {
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) return [];

  const { latitude, longitude } = input;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

  const categoryKey = input.category && input.category !== "all" ? input.category : undefined;
  const categories = categoryKey
    ? PLACE_CATEGORIES[categoryKey] || PLACE_CATEGORIES.attraction
    : // No category asked for: a broad mix, so "discover" shows variety rather
      // than fifty hotels.
      "accommodation.hotel,catering.restaurant,tourism.attraction,tourism.sights,commercial.shopping_mall,leisure.park";

  const params = new URLSearchParams({
    categories,
    filter: `circle:${longitude},${latitude},${input.radiusMeters ?? 30000}`,
    bias: `proximity:${longitude},${latitude}`,
    limit: String(Math.min(input.limit ?? 40, 100)),
    lang: "en",
    apiKey: key,
  });

  try {
    const response = await fetch(`${PLACES}?${params.toString()}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.warn(`[geoapify-places] HTTP ${response.status} for categories=${categories}`);
      return [];
    }

    const data = (await response.json()) as { features?: Feature[] };
    const features = Array.isArray(data.features) ? data.features : [];

    return features
      .map((feature): LivePlace | null => {
        const p = feature.properties;
        const name = str(p.name);
        // Unnamed nodes are noise in a browse list — a POI you cannot refer to
        // is not a destination.
        if (!name || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return null;

        const area = str(p.suburb) || str(p.neighbourhood) || str(p.district) || str(p.town);
        const city = str(p.city) || str(p.town) || str(p.district);
        const category = readableCategory(p.categories, categoryKey || "attraction");

        return {
          id: `live-${p.place_id ?? `${p.lat},${p.lon}`}`,
          name,
          category,
          description: str(p.formatted) || `${name}${area ? ` in ${area}` : ""}`,
          shortDescription: area ? `${category} in ${area}` : category,
          latitude: p.lat,
          longitude: p.lon,
          address: str(p.address_line2) || str(p.street) || str(p.formatted),
          city,
          country: str(p.country),
          countryIso2: str(p.country_code).toUpperCase(),
          imageUrl: null,
          // Geoapify does not carry ratings. Reporting 0 is honest; inventing a
          // 4.5 would put a fabricated number next to a real place.
          rating: 0,
          reviewCount: 0,
          isVerified: 0,
          isFeatured: 0,
          tags: (p.categories || []).slice(0, 4),
          source: "live",
        };
      })
      .filter((place): place is LivePlace => place !== null);
  } catch (error) {
    // Silently returning [] here hid a mapping bug for a whole debugging pass —
    // the request succeeded and the failure looked like "no results".
    console.warn("[geoapify-places] failed:", error);
    return [];
  }
};
