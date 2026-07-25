import { NextResponse } from "next/server";

const mockPlaces = [
  {
    id: "place-hunza",
    name: "Hunza Valley",
    country: "Pakistan",
    city: "Gilgit-Baltistan",
    category: "Nature",
    description: "Snow-covered mountains, turquoise lakes and peaceful valleys.",
    latitude: 36.3167,
    longitude: 74.65,
    rating: 4.9,
    isVerified: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "place-lahore",
    name: "Badshahi Mosque",
    country: "Pakistan",
    city: "Lahore",
    category: "Religious",
    description: "Historic Mughal architecture and culture.",
    latitude: 31.5881,
    longitude: 74.3106,
    rating: 4.9,
    isVerified: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "place-dubai",
    name: "Dubai Marina",
    country: "United Arab Emirates",
    city: "Dubai",
    category: "Cities",
    description: "Luxury waterfront and futuristic city experiences.",
    latitude: 25.0805,
    longitude: 55.1403,
    rating: 4.8,
    isVerified: true,
    createdAt: new Date().toISOString(),
  },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.toLowerCase() || "";
  const category = searchParams.get("category")?.toLowerCase() || "";

  const places = mockPlaces.filter((place) => {
    const matchesQuery =
      !query ||
      `${place.name} ${place.city} ${place.country}`.toLowerCase().includes(query);
    const matchesCategory =
      !category || place.category.toLowerCase() === category;

    return matchesQuery && matchesCategory;
  });

  return NextResponse.json({ success: true, data: places });
}
