import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../../db";
import { travelGroups, groupMembers } from "../../../../db/schema";
import { eq, like, or, sql } from "drizzle-orm";

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
    const search = searchParams.get("search");

    try {
      let query = db.select().from(travelGroups);
      if (search) {
        const q = search.toLowerCase();
        query = query.where(
          or(
            like(sql`LOWER(${travelGroups.name})`, `%${q}%`),
            like(sql`LOWER(${travelGroups.description})`, `%${q}%`)
          )
        );
      }
      const data = await query.orderBy(travelGroups.memberCount);
      if (data.length > 0) {
        const mapped = data.map(g => ({ ...g, tags: JSON.parse(g.tags || "[]") }));
        return NextResponse.json({ success: true, data: mapped });
      }
    } catch {
      // DB not available
    }

    let results: any[] = [];
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(g => g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q));
    }
    return NextResponse.json({ success: true, data: results.map(g => ({ ...g, tags: JSON.parse(g.tags) })) });
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
    const inserted = await db.insert(travelGroups).values({
      name: body.name,
      description: body.description,
      coverImage: body.coverImage,
      tags: JSON.stringify(body.tags || []),
      createdBy: userRecord.id,
      memberCount: 1,
      isPublic: body.isPublic !== false ? 1 : 0,
    }).returning();

    // Add creator as member
    await db.insert(groupMembers).values({
      groupId: inserted[0].id,
      userId: userRecord.id,
      role: "admin",
    });

    return NextResponse.json({
      success: true,
      data: { ...inserted[0], tags: JSON.parse(inserted[0].tags || "[]") }
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
