import { ilike, or } from "drizzle-orm";

import { db } from "../db";
import { geoCities, tourismPOIs } from "../db/schema";
import { searchTomTom, searchCategoryTomTom } from "./tomtom.service";

/**
 * Real place data for the trip planner.
 *
 * The planner previously had hand-written profiles for exactly five
 * destinations — hunza, lahore, karachi, makkah, dubai — and gave everywhere
 * else `genericProfile()`, which produced strings like "Paris main landmark",
 * "Paris heritage district" and "Paris local museum". Those are not places.
 * Any itinerary outside the five was filler with a city name pasted in.
 *
 * Places now come from, in order of preference:
 *   1. `tourism_pois` — curated rows, best for the cities we have seeded
 *   2. TomTom category search — real named POIs, worldwide coverage
 *
 * Verified category IDs (checked live against the TomTom API, not assumed):
 *   7376 tourist attraction · 7315 restaurant · 7314 hotel
 *   9361 shop/market       · 9362 park/recreation
 */

export type PlaceProfile = {
  attractions: string[];
  foods: string[];
  nature: string[];
  shopping: string[];
  hotel: string;
  /** Where the content came from, so callers can be honest about it. */
  source: "curated" | "live" | "mixed" | "none";
};

const CATEGORY = {
  attraction: "7376",
  restaurant: "7315",
  hotel: "7314",
  shopping: "9361",
  park: "9362",
} as const;

/** Drop duplicates and junk entries, preserving order. */
const clean = (names: Array<string | null | undefined>, limit: number): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = (raw || "").trim();
    if (name.length < 3) continue;
    if (/^unknown/i.test(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= limit) break;
  }
  return out;
};

export type ResolvedDestination = {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
};

/**
 * Turn a typed destination into coordinates: the seeded city catalogue first
 * (exact, free, no rate limit), then live geocoding for everywhere else.
 */
export const resolveDestination = async (input: string): Promise<ResolvedDestination | null> => {
  const term = input.trim();
  if (!term) return null;

  try {
    const rows = await db
      .select({
        name: geoCities.name,
        latitude: geoCities.latitude,
        longitude: geoCities.longitude,
        country: geoCities.countryIso2,
      })
      .from(geoCities)
      .where(ilike(geoCities.name, `%${term}%`))
      .limit(1);

    if (rows.length > 0) {
      return { name: rows[0].name, latitude: rows[0].latitude, longitude: rows[0].longitude, country: rows[0].country };
    }
  } catch {
    // Catalogue unavailable — geocoding below still works.
  }

  try {
    const results = await searchTomTom(term);
    const hit = results[0];
    if (hit?.position) {
      return {
        name: hit.name || term,
        latitude: hit.position.latitude,
        longitude: hit.position.longitude,
        country: hit.country,
      };
    }
  } catch {
    // No geocode — caller falls back to its curated profile.
  }

  return null;
};

/** Curated rows for this city, if we have any seeded. */
const curatedPois = async (destination: string) => {
  try {
    return await db
      .select({ name: tourismPOIs.name, category: tourismPOIs.category })
      .from(tourismPOIs)
      .where(or(ilike(tourismPOIs.city, `%${destination}%`), ilike(tourismPOIs.country, `%${destination}%`)))
      .limit(30);
  } catch {
    return [];
  }
};

/**
 * Build a profile of real, named places around a destination.
 * Returns `source: "none"` when nothing could be found, so the caller can fall
 * back rather than present empty sections as a plan.
 */
export const buildPlaceProfile = async (
  destination: string,
  coords: ResolvedDestination | null,
): Promise<PlaceProfile> => {
  const curated = await curatedPois(destination);

  const curatedAttractions = curated
    .filter((p) => !["restaurant", "hotel", "shopping"].includes((p.category || "").toLowerCase()))
    .map((p) => p.name);
  const curatedFood = curated.filter((p) => (p.category || "").toLowerCase() === "restaurant").map((p) => p.name);
  const curatedHotels = curated.filter((p) => (p.category || "").toLowerCase() === "hotel").map((p) => p.name);

  let live = {
    attractions: [] as string[],
    foods: [] as string[],
    nature: [] as string[],
    shopping: [] as string[],
    hotels: [] as string[],
  };

  if (coords) {
    const { latitude: lat, longitude: lon } = coords;
    // One round trip per category, in parallel. A category that fails yields an
    // empty list rather than failing the whole plan.
    const safe = async (set: string, radius: number, limit: number) => {
      try {
        return await searchCategoryTomTom(set, lat, lon, radius, limit);
      } catch {
        return [];
      }
    };

    const [attractions, restaurants, parks, shops, hotels] = await Promise.all([
      safe(CATEGORY.attraction, 30000, 20),
      safe(CATEGORY.restaurant, 20000, 20),
      safe(CATEGORY.park, 25000, 15),
      safe(CATEGORY.shopping, 20000, 15),
      safe(CATEGORY.hotel, 20000, 10),
    ]);

    live = {
      attractions: attractions.map((r) => r.name),
      foods: restaurants.map((r) => r.name),
      nature: parks.map((r) => r.name),
      shopping: shops.map((r) => r.name),
      hotels: hotels.map((r) => r.name),
    };
  }

  const attractions = clean([...curatedAttractions, ...live.attractions], 12);
  const foods = clean([...curatedFood, ...live.foods], 8);
  const nature = clean(live.nature, 6);
  const shopping = clean(live.shopping, 5);
  const hotelName = clean([...curatedHotels, ...live.hotels], 1)[0];

  const found = attractions.length + foods.length + nature.length + shopping.length;
  if (found === 0) return { attractions: [], foods: [], nature: [], shopping: [], hotel: "", source: "none" };

  return {
    attractions,
    foods,
    nature,
    shopping,
    hotel: hotelName ? `${hotelName} — or another well-reviewed stay in ${destination}` : "",
    source: curated.length > 0 && coords ? "mixed" : curated.length > 0 ? "curated" : "live",
  };
};
