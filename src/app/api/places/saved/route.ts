import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../../db";
import { savedPlaces } from "../../../../db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const userRecord = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, session.user!.email!),
  });
  
  if (!userRecord) return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });

  try {
    const data = await db.select().from(savedPlaces).where(eq(savedPlaces.userId, userRecord.id));
    
    // Map Drizzle camelCase schema back to the frontend's snake_case Row format
    // because savedPlacesService.ts expects `remote` to be `Row[]` with `user_id`, etc.
    const mapped = data.map(place => ({
      ...place,
      user_id: place.userId,
      last_visited_at: null, // Note: omitted in schema, assuming null
      created_at: place.createdAt.toISOString(),
      updated_at: place.createdAt.toISOString(), // We didn't add updatedAt, fallback to createdAt
    }));
    
    return NextResponse.json({ success: true, data: mapped });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const userRecord = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, session.user!.email!),
  });
  
  if (!userRecord) return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });

  try {
    const row = await req.json();
    
    // UPSERT logic for saved places
    // Wait, Drizzle doesn't have a simple upsert in PG without ON CONFLICT DO UPDATE.
    // We can do an insert with onConflictDoUpdate.
    const inserted = await db.insert(savedPlaces).values({
      id: row.id,
      userId: userRecord.id,
      label: row.label,
      name: row.name,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      category: row.category,
      notes: row.notes,
      favorite: row.favorite ? 1 : 0,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: savedPlaces.id,
      set: {
        label: row.label,
        name: row.name,
        address: row.address,
        latitude: row.latitude,
        longitude: row.longitude,
        category: row.category,
        notes: row.notes,
        favorite: row.favorite ? 1 : 0,
        updatedAt: new Date(),
      }
    }).returning();

    // The frontend expects the full SavedPlace object back (wait, it expects nothing, or { userId }).
    return NextResponse.json({ success: true, data: { userId: userRecord.id } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
