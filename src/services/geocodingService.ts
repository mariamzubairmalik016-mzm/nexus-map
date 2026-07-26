export type GeocodingResult = {
  displayName: string;
  latitude: number;
  longitude: number;
};

type ApiResult = {
  display_name: string;
  lat: string;
  lon: string;
};

export const searchLocation = async (query: string): Promise<GeocodingResult | null> => {
  const params = new URLSearchParams({
    q: query.trim(),
    format: "jsonv2",
    limit: "1",
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    { headers: { Accept: "application/json" } },
  );

  if (!response.ok) throw new Error("Location search service is unavailable.");
  const data = (await response.json()) as ApiResult[];
  const first = data[0];
  if (!first) return null;

  return {
    displayName: first.display_name,
    latitude: Number(first.lat),
    longitude: Number(first.lon),
  };
};
