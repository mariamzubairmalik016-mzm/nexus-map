import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../db";
import { communityNotes } from "../../../../db/schema";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { and, gte, lte } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bbox = searchParams.get("bbox");

  try {
    let query = db.select().from(communityNotes);

    if (bbox) {
      const [west, south, east, north] = bbox.split(",").map(Number);
      if ([west, south, east, north].every(Number.isFinite)) {
        query = query.where(
          and(
            gte(communityNotes.longitude, west),
            lte(communityNotes.longitude, east),
            gte(communityNotes.latitude, south),
            lte(communityNotes.latitude, north)
          )
        ) as any;
      }
    }

    const data = await query;
    const formatted = data.map(note => ({
      ...note,
      position: { latitude: note.latitude, longitude: note.longitude },
      status: "verified",
      helpfulCount: 0,
    }));

    return NextResponse.json({ success: true, data: formatted });
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
    where: (users, { eq }) => eq(users.email, session.user.email!),
  });
  
  if (!userRecord) return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });

  try {
    const body = await req.json();
    const inserted = await db.insert(communityNotes).values({
      userId: userRecord.id,
      title: body.title,
      description: body.description,
      category: body.category,
      latitude: body.position.latitude,
      longitude: body.position.longitude,
    }).returning();

    const formatted = {
      ...inserted[0],
      position: { latitude: inserted[0].latitude, longitude: inserted[0].longitude },
      status: "pending",
      helpfulCount: 0,
    };

    return NextResponse.json({ success: true, data: formatted }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
