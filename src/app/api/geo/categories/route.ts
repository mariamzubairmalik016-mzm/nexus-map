import { NextResponse } from "next/server";
import { db } from "../../../../db";
import { geoLocationCategories } from "../../../../db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  try {
    const data = await db.select({
      id: geoLocationCategories.id,
      name: geoLocationCategories.name,
      slug: geoLocationCategories.slug,
      icon_name: geoLocationCategories.iconName,
      description: geoLocationCategories.description,
    })
      .from(geoLocationCategories)
      .where(eq(geoLocationCategories.isActive, 1))
      .orderBy(asc(geoLocationCategories.name));

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/geo/categories error:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
