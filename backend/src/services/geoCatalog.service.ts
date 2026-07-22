import { supabaseAdmin } from "../config/supabase.js";
import { toNormalizedPlace, type NormalizedPlace } from "../types/place.js";

/**
 * The project's own curated city catalogue in Supabase. Used as a third,
 * supplementary source so well-known cities resolve instantly even if a
 * provider is slow or rate-limited.
 */
export const searchGeoCatalog = async (
  query: string,
  limit = 8,
): Promise<NormalizedPlace[]> => {
  if (!supabaseAdmin || query.trim().length < 2) return [];

  const clean = query.trim();

  const { data, error } = await supabaseAdmin
    .from("geo_cities")
    .select("id,name,country_iso2,region_code,city_type,latitude,longitude")
    .eq("is_active", true)
    .or(`name.ilike.%${clean}%,slug.ilike.%${clean}%`)
    .order("is_featured", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Geo catalog search failed:", error.message);
    return [];
  }

  return (data ?? [])
    .map((item) =>
      toNormalizedPlace({
        id: `supabase-${item.id}`,
        provider: "supabase",
        providerId: String(item.id),
        name: item.name,
        address: [item.name, item.region_code, item.country_iso2].filter(Boolean).join(", "),
        city: item.name,
        province: item.region_code ?? undefined,
        country: item.country_iso2,
        countryCode: item.country_iso2,
        category: item.city_type,
        score: 0.7,
        lat: item.latitude,
        lng: item.longitude,
      }),
    )
    .filter((place): place is NormalizedPlace => place !== null);
};
