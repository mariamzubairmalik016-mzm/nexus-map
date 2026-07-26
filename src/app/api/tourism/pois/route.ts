import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../db";
import { tourismPOIs } from "../../../../db/schema";
import { like, or, and, eq, sql } from "drizzle-orm";

import { searchTomTom } from "../../../../services/tomtom.service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query");
    const category = searchParams.get("category");
    const city = searchParams.get("city");
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

    // Try to load from DB first
    try {
      const conditions = [];

      if (category) {
        conditions.push(eq(tourismPOIs.category, category));
      }
      if (city) {
        const cityLower = city.toLowerCase();
        conditions.push(
          or(
            like(sql`LOWER(${tourismPOIs.city})`, `%${cityLower}%`),
            like(sql`LOWER(${tourismPOIs.country})`, `%${cityLower}%`)
          )
        );
      }
      if (query) {
        const q = query.toLowerCase();
        conditions.push(
          or(
            like(sql`LOWER(${tourismPOIs.name})`, `%${q}%`),
            like(sql`LOWER(${tourismPOIs.description})`, `%${q}%`)
          )
        );
      }

      const data = await db
        .select()
        .from(tourismPOIs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .limit(limit);
      
      if (data.length > 0) {
        const mapped = data.map(p => ({ ...p, tags: JSON.parse(p.tags || "[]") }));
        return NextResponse.json({ success: true, data: mapped });
      }
    } catch {
      // DB not available, fall through to seed data
    }

    // Fallback: search TomTom for live places
    const searchString = `${category || "tourist attractions"} in ${city || query || "Pakistan"}`;
    
    try {
      const liveResults = await searchTomTom(searchString);
      
      const mappedResults = liveResults.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category || category || "poi",
        description: p.address,
        shortDescription: p.city || p.country,
        latitude: p.position.latitude,
        longitude: p.position.longitude,
        address: p.address,
        city: p.city,
        country: p.country,
        rating: 4.5, // Mock rating for external POIs
        reviewCount: Math.floor(Math.random() * 500) + 10,
        isVerified: 1,
        isFeatured: 0,
        tags: []
      }));

      return NextResponse.json({
        success: true,
        data: mappedResults.slice(0, limit)
      });
    } catch (err) {
      console.error("TomTom POI search failed", err);
      return NextResponse.json({ success: true, data: [] });
    }
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    // Seed action removed because SEED_POIS is removed.
    if (action === "seed") {
      return NextResponse.json({ success: true, data: { seeded: 0, message: "Static seeding disabled, using live TomTom data instead" } });
    }

    return NextResponse.json({ success: false, message: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
