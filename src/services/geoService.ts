import { supabase } from "../lib/supabase";
import type { GeoCategory, GeoCity } from "../types/geo";

const requireSupabase = () => {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }

  return supabase;
};

export const geoService = {
  async getCities(options?: {
    query?: string;
    category?: string;
    countryIso2?: string;
    featuredOnly?: boolean;
    limit?: number;
  }): Promise<GeoCity[]> {
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

    if (options?.countryIso2) {
      request = request.eq("country_iso2", options.countryIso2);
    }

    if (options?.featuredOnly) {
      request = request.eq("is_featured", true);
    }

    if (options?.category && options.category !== "All") {
      const categoryMap: Record<string, string[]> = {
        Nature: ["town", "village", "landmark"],
        Cities: ["capital", "city", "locality"],
        Heritage: ["landmark"],
        Religious: ["landmark"],
        Adventure: ["town", "village", "landmark"],
      };

      const types = categoryMap[options.category];
      if (types?.length) {
        request = request.in("city_type", types);
      }
    }

    const cleanQuery = options?.query?.trim();
    if (cleanQuery) {
      request = request.or(
        `name.ilike.%${cleanQuery}%,slug.ilike.%${cleanQuery}%`,
      );
    }

    const { data, error } = await request;

    if (error) throw error;
    return (data ?? []) as GeoCity[];
  },

  async getFeaturedCities(limit = 8): Promise<GeoCity[]> {
    return this.getCities({ featuredOnly: true, limit });
  },

  async getCategories(): Promise<GeoCategory[]> {
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

    return this.getCities({
      query: clean,
      limit,
    });
  },
};
