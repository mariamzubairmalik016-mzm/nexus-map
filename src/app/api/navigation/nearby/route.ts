import { NextRequest, NextResponse } from "next/server";

import { fetchLivePlaces, PLACE_CATEGORIES } from "../../../../services/geoapifyPlaces.service";

export const dynamic = "force-dynamic";

/**
 * What is around a point.
 *
 * Opening a place from Explore dropped a pin and nothing else — you could see
 * where somewhere was, but not what was near it, which is the thing you
 * actually want before going. This backs a "nearby" panel on the map.
 *
 * Distance is computed here rather than in the browser so the list arrives
 * already ordered by how far away things are.
 */

const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  Math.hypot((b.lat - a.lat) * 111, (b.lon - a.lon) * 111 * Math.cos((a.lat * Math.PI) / 180));

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // `Number(null)` is 0, not NaN, so a missing parameter would otherwise read
  // as a valid coordinate at 0,0.
  const raw = (name: string) => {
    const value = searchParams.get(name);
    if (value === null || value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const lat = raw("lat");
  const lon = raw("lon");
  const category = searchParams.get("category") || undefined;
  const radius = Math.min(raw("radius") ?? 5000, 20000);

  if (lat === null || lon === null) {
    return NextResponse.json({ success: false, message: "lat and lon are required" }, { status: 400 });
  }

  if (category && category !== "all" && !PLACE_CATEGORIES[category]) {
    return NextResponse.json(
      { success: false, message: `Unknown category. Try: ${Object.keys(PLACE_CATEGORIES).join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const places = await fetchLivePlaces({
      latitude: lat,
      longitude: lon,
      category,
      radiusMeters: radius,
      limit: 40,
    });

    const withDistance = places
      .map((place) => ({
        ...place,
        distanceKm:
          Math.round(km({ lat, lon }, { lat: place.latitude, lon: place.longitude }) * 10) / 10,
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return NextResponse.json({
      success: true,
      data: withDistance,
      meta: { centre: { latitude: lat, longitude: lon }, radius, count: withDistance.length },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
