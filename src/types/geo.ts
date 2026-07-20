export type GeoCity = {
  id: string;
  country_iso2: string;
  region_code: string | null;
  name: string;
  slug: string;
  city_type:
    | "capital"
    | "city"
    | "town"
    | "village"
    | "locality"
    | "landmark";
  latitude: number;
  longitude: number;
  population: number | null;
  image_url: string | null;
  description: string | null;
  search_keywords: string[];
  is_featured: boolean;
};

export type GeoCategory = {
  id: string;
  name: string;
  slug: string;
  icon_name: string | null;
  description: string | null;
};

export type FavoriteRecord = {
  id: string;
  user_id: string;
  place_id: string;
  created_at: string;
};
