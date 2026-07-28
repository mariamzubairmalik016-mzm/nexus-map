import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../../db";
import { communityTips } from "../../../../db/schema";
import { eq } from "drizzle-orm";

/**
 * No seed fallback.
 *
 * This route used to return a hardcoded array when the table was empty, so a
 * fresh deployment showed invented posts attributed to invented people
 * ("Ali Khan", "Fatima Zaidi") as if they were real community activity. An
 * empty table now returns an empty list and the UI shows a real empty state.
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    try {
      let query = db.select().from(communityTips);
      if (category && category !== "all") query = query.where(eq(communityTips.category, category));
      const data = await query.orderBy(communityTips.createdAt);
      if (data.length > 0) return NextResponse.json({ success: true, data });
    } catch {
      // DB not available
    }

    let results: any[] = [];
    if (category && category !== "all") results = results.filter(t => t.category === category);
    results.sort((a, b) => b.likes - a.likes);
    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const userRecord = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, session.user.email!),
    });
    if (!userRecord) return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });

    const body = await req.json();
    const inserted = await db.insert(communityTips).values({
      userId: userRecord.id,
      userName: session.user.name || "User",
      title: body.title,
      content: body.content,
      category: body.category,
    }).returning();

    return NextResponse.json({ success: true, data: inserted[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
