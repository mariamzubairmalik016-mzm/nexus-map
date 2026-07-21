import { supabase } from "../lib/supabase";
import { offlineDb } from "./offlineDb";
import { networkStatus } from "./networkStatus";
import type { GeoCategory, GeoCity } from "../types/geo";

const requireSupabase = () => {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }
  return supabase;
};

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

export const geoService = {
  async getCities(options?: CityOptions): Promise<GeoCity[]> {
    // Offline (or no Supabase): serve the cached destination set locally.
    if (networkStatus.isOffline() || !supabase) {
      const cached = await offlineDb.getDestinations<GeoCity>().catch(() => []);
      return filterLocally(cached, options);
    }

    try {
      const client = requireSupabase();
      let request = client
        .from("geo_cities")
        .select(
          "id,country_iso2,region_code,name,slug,city_type,latitude,longitude,population,image_url,description,search_keywords,is_featured",
        )
        .eq("is_active", true)
        .order("is_featured", { ascending: false })
        .order("name", { ascending: true })
        .limit(options?.limit ?? 100);

      if (options?.countryIso2) request = request.eq("country_iso2", options.countryIso2);
      if (options?.featuredOnly) request = request.eq("is_featured", true);
      if (options?.category && options.category !== "All") {
        const types = CATEGORY_MAP[options.category];
        if (types?.length) request = request.in("city_type", types);
      }
      const cleanQuery = options?.query?.trim();
      if (cleanQuery) {
        request = request.or(`name.ilike.%${cleanQuery}%,slug.ilike.%${cleanQuery}%`);
      }

      const { data, error } = await request;
      if (error) throw error;
      const cities = (data ?? []) as GeoCity[];
      // Cache for offline use (accumulates the destinations the user has seen).
      void offlineDb.saveDestinations(cities).catch(() => {});
      return cities;
    } catch (error) {
      // Network / Supabase failed — fall back to the cache if we have anything.
      const cached = await offlineDb.getDestinations<GeoCity>().catch(() => []);
      if (cached.length) return filterLocally(cached, options);
      throw error;
    }
  },

  async getFeaturedCities(limit = 8): Promise<GeoCity[]> {
    return this.getCities({ featuredOnly: true, limit });
  },

  async getCategories(): Promise<GeoCategory[]> {
    if (networkStatus.isOffline() || !supabase) return [];
    const client = requireSupabase();
    const { data, error } = await client
      .from("geo_location_categories")
      .select("id,name,slug,icon_name,description")
      .eq("is_active", true)
      .order("name");
    if (error) throw error;
    return (data ?? []) as GeoCategory[];
  },

  async searchCities(query: string, limit = 8): Promise<GeoCity[]> {
    const clean = query.trim();
    if (clean.length < 2) return [];
    return this.getCities({ query: clean, limit });
  },
};
