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
  source: "catalog";
};

export const searchGeoCatalog = async (
  query: string,
  limit = 8,
): Promise<CatalogSearchResult[]> => {
  if (query.trim().length < 2) return [];

  const clean = query.trim();

  try {
    const params = new URLSearchParams({ query: clean, limit: String(limit) });
    // Use the new API route instead of Supabase directly
    const res = await fetch(`/api/geo/cities?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch cities from catalog");

    const data = await res.json();
    return (data ?? []).map((item: any) => ({
      id: `catalog-${item.id}`,
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
      source: "catalog" as const,
    }));
  } catch (error: any) {
    console.error("Geo catalog search failed:", error.message);
    return [];
  }
};
