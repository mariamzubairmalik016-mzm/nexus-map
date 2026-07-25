import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { db } from "../../../db";
import { favorites } from "../../../db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  // Get user id from session. Wait, NextAuth session doesn't include user id by default unless configured in callbacks.
  // We can look up the user by email, or we should update authOptions to include user.id.
  const userRecord = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, session.user.email!),
  });
  
  if (!userRecord) return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });

  try {
    const data = await db.select().from(favorites).where(eq(favorites.userId, userRecord.id));
    return NextResponse.json({ success: true, data });
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
    const { placeId } = await req.json();
    if (!placeId) return NextResponse.json({ success: false, message: "placeId is required" }, { status: 400 });

    const existing = await db.select().from(favorites).where(and(eq(favorites.userId, userRecord.id), eq(favorites.placeId, placeId)));
    if (existing.length > 0) {
      return NextResponse.json({ success: true, data: existing[0] });
    }

    const inserted = await db.insert(favorites).values({
      userId: userRecord.id,
      placeId,
    }).returning();

    return NextResponse.json({ success: true, data: inserted[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
