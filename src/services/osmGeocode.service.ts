/**
 * OpenStreetMap (Nominatim) geocoding — street-level fallback.
 *
 * Why this exists: TomTom has effectively no street-level data for Pakistan.
 * Measured directly against the live API:
 *
 *   reverseGeocode(31.5497, 74.3436)  ->  "Islamabad, Punjab"   (that is Lahore)
 *   geocode("Mall Road Lahore")       ->  no result
 *   geocode("Ferozepur Road Lahore")  ->  no result
 *   geocode("Liberty Market Lahore")  ->  no result
 *
 * Its Pakistan index holds cities and little else, which is why destination
 * search only ever offered cities. OSM returns all of the above correctly, so
 * it fills in streets, neighbourhoods, markets and sectors.
 *
 * TomTom stays primary — it is the routing provider and its POI data is
 * stronger in most of the world. This supplements rather than replaces.
 *
 * Nominatim's usage policy allows light use with an identifying User-Agent and
 * at most ~1 request/second. The debounce in front of search keeps us well
 * inside that for interactive typing; a high-traffic deployment should move to
 * a self-hosted Nominatim or a paid OSM provider.
 */

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";

// Nominatim blocks requests without a real identifying User-Agent.
const USER_AGENT = "NexusMap/1.0 (+https://github.com/nexus-map; travel navigation app)";

export type OsmPlace = {
  id: string;
  name: string;
  address: string;
  city?: string;
  country?: string;
  category?: string;
  /**
   * Nominatim's global prominence score, roughly 0–1: a capital sits near 0.8,
   * a hamlet near 0.2. It is the only signal any of the three providers gives
   * that separates same-named places by significance, which is what tells
   * "Islamabad" the capital from the village of Islamabad in Sindh.
   */
  importance?: number;
  position: { latitude: number; longitude: number };
};

type NominatimResult = {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  type?: string;
  category?: string;
  importance?: number;
  address?: Record<string, string>;
};

/**
 * @param countryCodes Optional ISO-3166 alpha-2 list, e.g. "pk". Constrains
 *        results to a country, which matters near borders — Lahore sits ~50 km
 *        from India, whose OSM/TomTom coverage is denser, so an unconstrained
 *        search for a Lahore street surfaces Amritsar first.
 */
export const searchOsm = async (
  query: string,
  countryCodes?: string,
  limit = 8,
): Promise<OsmPlace[]> => {
  const term = query.trim();
  if (term.length < 2) return [];

  const params = new URLSearchParams({
    q: term,
    format: "jsonv2",
    addressdetails: "1",
    limit: String(limit),
    "accept-language": "en",
  });
  if (countryCodes) params.set("countrycodes", countryCodes.toLowerCase());

  try {
    const response = await fetch(`${NOMINATIM}?${params.toString()}`, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return [];

    const results = (await response.json()) as NominatimResult[];
    if (!Array.isArray(results)) return [];

    return results
      .map((r): OsmPlace | null => {
        const latitude = Number(r.lat);
        const longitude = Number(r.lon);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

        const addr = r.address || {};
        // display_name leads with the specific part; use it when Nominatim did
        // not give a discrete `name` (plain streets often have none).
        const name = r.name?.trim() || r.display_name.split(",")[0].trim();

        return {
          id: `osm-${r.place_id}`,
          name,
          address: r.display_name,
          city: addr.city || addr.town || addr.village || addr.state_district,
          country: addr.country,
          category: r.type || r.category,
          importance: typeof r.importance === "number" ? r.importance : undefined,
          position: { latitude, longitude },
        };
      })
      .filter((place): place is OsmPlace => place !== null);
  } catch {
    // Timeout, rate limit, or offline — TomTom results still stand on their own.
    return [];
  }
};

/**
 * Name the place at a coordinate — used to label a GPS fix.
 *
 * The map used to show a fix as the bare string "Current Location", which hid
 * a real failure mode: browser geolocation on a laptop has no GPS radio and
 * positions by WiFi/IP, routinely landing kilometres off. A user in North
 * Nazimabad was placed in Naya Nazimabad — 4.5 km away and a different town —
 * and had no way to notice until the route drew from the wrong place.
 *
 * OSM rather than TomTom because TomTom cannot resolve these areas at all:
 * reverseGeocode(24.9425, 67.0477) returns "Karachi, Sind" with no street and
 * no subdivision, while OSM returns "Shahrah-e-Jahangir, North Nazimabad Town".
 */
export const reverseOsm = async (
  latitude: number,
  longitude: number,
): Promise<{ label: string; area?: string; city?: string } | null> => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    "accept-language": "en",
    zoom: "16", // neighbourhood level — street is too specific for a start label
  });

  try {
    const response = await fetch(`${NOMINATIM_REVERSE}?${params.toString()}`, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    const addr = data.address || {};

    const area =
      addr.suburb || addr.neighbourhood || addr.town || addr.city_district || addr.quarter || addr.village;
    const city = addr.city || addr.state_district || addr.county;

    const label = [area, city].filter(Boolean).join(", ") || data.display_name?.split(",").slice(0, 2).join(",").trim();

    return label ? { label, area, city } : null;
  } catch {
    return null;
  }
};
