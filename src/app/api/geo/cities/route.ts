import { NextResponse } from "next/server";
import { db } from "../../../../db";
import { geoCities } from "../../../../db/schema";
import { eq, or, ilike, inArray, desc, asc, and } from "drizzle-orm";

const CATEGORY_MAP: Record<string, string[]> = {
  Nature: ["town", "village", "landmark"],
  Cities: ["capital", "city", "locality"],
  Heritage: ["landmark"],
  Religious: ["landmark"],
  Adventure: ["town", "village", "landmark"],
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const countryIso2 = searchParams.get("countryIso2");
    const featuredOnly = searchParams.get("featuredOnly") === "true";
    const category = searchParams.get("category");
    const query = searchParams.get("query")?.trim();
    const limit = Number(searchParams.get("limit")) || 100;

    let conditions = [eq(geoCities.isActive, 1)];

    if (countryIso2) {
      conditions.push(eq(geoCities.countryIso2, countryIso2));
    }
    if (featuredOnly) {
      conditions.push(eq(geoCities.isFeatured, 1));
    }
    if (category && category !== "All") {
      const types = CATEGORY_MAP[category];
      if (types?.length) {
        conditions.push(inArray(geoCities.cityType, types));
      }
    }
    if (query) {
      conditions.push(
        or(
          ilike(geoCities.name, `%${query}%`),
          ilike(geoCities.slug, `%${query}%`)
        ) as any
      );
    }

    const data = await db.select({
      id: geoCities.id,
      country_iso2: geoCities.countryIso2,
      region_code: geoCities.regionCode,
      name: geoCities.name,
      slug: geoCities.slug,
      city_type: geoCities.cityType,
      latitude: geoCities.latitude,
      longitude: geoCities.longitude,
      population: geoCities.population,
      image_url: geoCities.imageUrl,
      description: geoCities.description,
      search_keywords: geoCities.searchKeywords,
      is_featured: geoCities.isFeatured,
    })
      .from(geoCities)
      .where(and(...conditions))
      .orderBy(desc(geoCities.isFeatured), asc(geoCities.name))
      .limit(limit);

    const mappedData = data.map(city => ({
      ...city,
      is_featured: city.is_featured === 1,
    }));

    return NextResponse.json(mappedData);
  } catch (error) {
    console.error("GET /api/geo/cities error:", error);
    return NextResponse.json(
      { error: "Failed to fetch cities" },
      { status: 500 }
    );
  }
}
