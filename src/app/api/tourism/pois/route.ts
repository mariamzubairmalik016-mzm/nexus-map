import { NextRequest, NextResponse } from "next/server";
import { ilike, or, and, eq } from "drizzle-orm";

import { db } from "../../../../db";
import { tourismPOIs } from "../../../../db/schema";
import { fetchLivePlaces } from "../../../../services/geoapifyPlaces.service";
import { resolveDestination } from "../../../../services/tripPlaces";

export const dynamic = "force-dynamic";

/**
 * Tourism places: curated rows plus live results.
 *
 * Previously this served twelve seeded rows and, when they did not match, fell
 * back to a TomTom text search that attached `rating: 4.5` and
 * `reviewCount: Math.floor(Math.random() * 500)` to every result — a made-up
 * score and a made-up review count on a real business. Both are gone.
 *
 * Curated rows come first because they carry descriptions and imagery no POI
 * API returns; live results cover everywhere else.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query");
    const category = searchParams.get("category");
    const city = searchParams.get("city");
    const limit = Math.min(Number(searchParams.get("limit")) || 60, 100);

    /**
     * Parse only when the parameter is actually present.
     *
     * `Number(null)` is 0, not NaN, so reading a missing `lat`/`lon` through
     * `Number(...)` produced a finite 0 and the request was treated as
     * "centred on 0,0" — a point in the Atlantic. Searching by city name alone
     * therefore returned nothing at all.
     */
    const num = (name: string): number | null => {
      const raw = searchParams.get(name);
      if (raw === null || raw.trim() === "") return null;
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    };

    const latParam = num("lat");
    const lonParam = num("lon");
    const radius = Math.min(num("radius") || 30000, 50000);

    // ---- Curated rows ------------------------------------------------------
    let curated: Array<Record<string, unknown>> = [];
    try {
      const conditions = [];
      if (category && category !== "all") conditions.push(eq(tourismPOIs.category, category));
      if (city) {
        conditions.push(or(ilike(tourismPOIs.city, `%${city}%`), ilike(tourismPOIs.country, `%${city}%`)));
      }
      if (query) {
        conditions.push(
          or(ilike(tourismPOIs.name, `%${query}%`), ilike(tourismPOIs.description, `%${query}%`)),
        );
      }

      const rows = await db
        .select()
        .from(tourismPOIs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .limit(limit);

      curated = rows.map((p) => ({
        ...p,
        tags: (() => {
          try {
            return JSON.parse(p.tags || "[]");
          } catch {
            return [];
          }
        })(),
        source: "curated",
      }));
    } catch {
      // Database unavailable — the live results below still answer.
    }

    // ---- Live results ------------------------------------------------------
    // Needs a coordinate: use one if supplied, else resolve the city or the
    // free-text query to a point.
    let centre: { latitude: number; longitude: number } | null =
      latParam !== null && lonParam !== null
        ? { latitude: latParam, longitude: lonParam }
        : null;

    if (!centre && (city || query)) {
      const resolved = await resolveDestination((city || query) as string);
      if (resolved) centre = { latitude: resolved.latitude, longitude: resolved.longitude };
    }

    const live = centre
      ? await fetchLivePlaces({
          latitude: centre.latitude,
          longitude: centre.longitude,
          category: category || undefined,
          radiusMeters: radius,
          limit,
        })
      : [];

    // Geoapify searches by category and area, not by name, so a free-text
    // query still has to filter the live set.
    const needle = query?.trim().toLowerCase();
    const filteredLive = needle
      ? live.filter(
          (p) => p.name.toLowerCase().includes(needle) || p.city.toLowerCase().includes(needle),
        )
      : live;

    /**
     * Keep curated rows only when they are actually near where we are looking.
     *
     * The curated query filters by city name and category, not by coordinate,
     * so a search centred on Karachi was returning "Serena Hotel Hunza" —
     * 1,400 km away — simply because it is a hotel. Once a centre is known,
     * distance has to apply to both sources or the curated ones ignore it.
     */
    const nearCentre = centre
      ? curated.filter((p) => {
          const lat = Number(p.latitude);
          const lon = Number(p.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
          const km = Math.hypot(
            (lat - centre!.latitude) * 111,
            (lon - centre!.longitude) * 111 * Math.cos((centre!.latitude * Math.PI) / 180),
          );
          return km <= radius / 1000;
        })
      : curated;

    // ---- Merge -------------------------------------------------------------
    const seen = new Set(
      nearCentre.map((p) => `${String(p.name).toLowerCase()}|${Number(p.latitude).toFixed(3)}`),
    );

    const merged = [
      ...nearCentre,
      ...filteredLive.filter((p) => {
        const key = `${p.name.toLowerCase()}|${p.latitude.toFixed(3)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    ];

    return NextResponse.json({
      success: true,
      data: merged.slice(0, limit),
      meta: { curated: nearCentre.length, live: filteredLive.length, centre },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
