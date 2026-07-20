import { supabaseAdmin } from "../config/supabase.js";

export type CatalogSearchResult = {
  id: string;
  name: string;
  address: string;
  city?: string;
  country?: string;
  category?: string;
  position: {
    latitude: number;
    longitude: number;
  };
  source: "supabase";
};

export const searchGeoCatalog = async (
  query: string,
  limit = 8,
): Promise<CatalogSearchResult[]> => {
  if (!supabaseAdmin || query.trim().length < 2) return [];

  const clean = query.trim();

  const { data, error } = await supabaseAdmin
    .from("geo_cities")
    .select(
      "id,name,country_iso2,region_code,city_type,latitude,longitude",
    )
    .eq("is_active", true)
    .or(`name.ilike.%${clean}%,slug.ilike.%${clean}%`)
    .order("is_featured", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Geo catalog search failed:", error.message);
    return [];
  }

  return (data ?? []).map((item) => ({
    id: `supabase-${item.id}`,
    name: item.name,
    address: [
      item.name,
      item.region_code,
      item.country_iso2,
    ]
      .filter(Boolean)
      .join(", "),
    city: item.name,
    country: item.country_iso2,
    category: item.city_type,
    position: {
      latitude: item.latitude,
      longitude: item.longitude,
    },
    source: "supabase" as const,
  }));
};
