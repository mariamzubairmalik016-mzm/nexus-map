import { offlineDb } from "./offlineDb";
import { networkStatus } from "./networkStatus";
import type { GeoCategory, GeoCity } from "../types/geo";

const CATEGORY_MAP: Record<string, string[]> = {
  Nature: ["town", "village", "landmark"],
  Cities: ["capital", "city", "locality"],
  Heritage: ["landmark"],
  Religious: ["landmark"],
  Adventure: ["town", "village", "landmark"],
};

type CityOptions = {
  query?: string;
  category?: string;
  countryIso2?: string;
  featuredOnly?: boolean;
  limit?: number;
};

// Client-side equivalent of the server query, used when serving from the
// offline destinations cache.
const filterLocally = (cities: GeoCity[], options?: CityOptions): GeoCity[] => {
  let list = [...cities];
  if (options?.countryIso2) list = list.filter((c) => c.country_iso2 === options.countryIso2);
  if (options?.featuredOnly) list = list.filter((c) => c.is_featured);
  if (options?.category && options.category !== "All") {
    const types = CATEGORY_MAP[options.category];
    if (types?.length) list = list.filter((c) => types.includes(c.city_type));
  }
  const q = options?.query?.trim().toLowerCase();
  if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || c.slug?.toLowerCase().includes(q));
  list.sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || a.name.localeCompare(b.name));
  return list.slice(0, options?.limit ?? 100);
};

const MOCK_CITIES = [
  { id: "1", name: "Hunza Valley", slug: "hunza-valley", country_iso2: "PK", city_type: "town", is_featured: true, image_url: "/destinations/hunza.jpg", description: "Snow-covered mountains, lakes and peaceful valleys.", latitude: 36.3167, longitude: 74.65 },
  { id: "2", name: "Skardu", slug: "skardu", country_iso2: "PK", city_type: "town", is_featured: true, image_url: "/destinations/skardu.jpg", description: "Dramatic landscapes, lakes and adventures.", latitude: 35.2971, longitude: 75.6333 },
  { id: "3", name: "Lahore", slug: "lahore", country_iso2: "PK", city_type: "city", is_featured: false, image_url: "/destinations/lahore.jpg", description: "Historic Mughal architecture and culture.", latitude: 31.5204, longitude: 74.3587 },
  { id: "4", name: "Islamabad", slug: "islamabad", country_iso2: "PK", city_type: "city", is_featured: false, image_url: "/destinations/islamabad.jpg", description: "A modern landmark at the Margalla Hills.", latitude: 33.6844, longitude: 73.0479 },
  { id: "5", name: "Karachi", slug: "karachi", country_iso2: "PK", city_type: "city", is_featured: false, image_url: "/destinations/karachi.jpg", description: "Pakistan's coastal metropolis.", latitude: 24.8607, longitude: 67.0011 },
  { id: "6", name: "Dubai", slug: "dubai", country_iso2: "AE", city_type: "city", is_featured: false, image_url: "/destinations/dubai.jpg", description: "Luxury waterfront and futuristic experiences.", latitude: 25.2048, longitude: 55.2708 },
  { id: "7", name: "Istanbul", slug: "istanbul", country_iso2: "TR", city_type: "city", is_featured: false, image_url: "/destinations/istanbul.jpg", description: "Asian and European history and culture.", latitude: 41.0082, longitude: 28.9784 },
  { id: "8", name: "Tokyo", slug: "tokyo", country_iso2: "JP", city_type: "city", is_featured: false, image_url: "/destinations/tokyo.jpg", description: "Technology, tradition and urban energy.", latitude: 35.6762, longitude: 139.6503 },
  { id: "9", name: "Paris", slug: "paris", country_iso2: "FR", city_type: "city", is_featured: false, image_url: "/destinations/paris.jpg", description: "Architecture, museums and cafés.", latitude: 48.8566, longitude: 2.3522 },
  { id: "10", name: "Bali", slug: "bali", country_iso2: "ID", city_type: "town", is_featured: false, image_url: "/destinations/bali.jpg", description: "Beaches, temples and forests.", latitude: -8.4095, longitude: 115.1889 }
] as GeoCity[];

export const geoService = {
  async getCities(options?: CityOptions): Promise<GeoCity[]> {
    // Offline: serve the cached destination set locally.
    if (networkStatus.isOffline()) {
      const cached = await offlineDb.getDestinations<GeoCity>().catch(() => []);
      return filterLocally(cached.length ? cached : MOCK_CITIES, options);
    }

    try {
      const params = new URLSearchParams();
      if (options?.countryIso2) params.set("countryIso2", options.countryIso2);
      if (options?.featuredOnly) params.set("featuredOnly", "true");
      if (options?.category) params.set("category", options.category);
      if (options?.query) params.set("query", options.query);
      if (options?.limit) params.set("limit", String(options.limit));

      const res = await fetch(`/api/geo/cities?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch cities");
      
      const cities = await res.json() as GeoCity[];
      // Cache for offline use
      void offlineDb.saveDestinations(cities).catch(() => {});
      return cities;
    } catch (error) {
      // Network failed — fall back to the cache if we have anything.
      const cached = await offlineDb.getDestinations<GeoCity>().catch(() => []);
      if (cached.length) return filterLocally(cached, options);
      
      return filterLocally(MOCK_CITIES, options);
    }
  },

  async getFeaturedCities(limit = 8): Promise<GeoCity[]> {
    return this.getCities({ featuredOnly: true, limit });
  },

  async getCategories(): Promise<GeoCategory[]> {
    if (networkStatus.isOffline()) return [];
    try {
      const res = await fetch(`/api/geo/categories`);
      if (!res.ok) throw new Error("Failed to fetch categories");
      return await res.json() as GeoCategory[];
    } catch (error) {
      return [];
    }
  },

  async searchCities(query: string, limit = 8): Promise<GeoCity[]> {
    const clean = query.trim();
    if (clean.length < 2) return [];
    return this.getCities({ query: clean, limit });
  },
};
