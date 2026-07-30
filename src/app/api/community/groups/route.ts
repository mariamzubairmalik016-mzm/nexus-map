import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../../db";
import { travelGroups, groupMembers } from "../../../../db/schema";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { viewerFromSession } from "../../../../db/communityEngagement";

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
      const q = search?.toLowerCase();
      const where = q
        ? or(
            like(sql`LOWER(${travelGroups.name})`, `%${q}%`),
            like(sql`LOWER(${travelGroups.description})`, `%${q}%`),
          )
        : undefined;
      // Biggest first. Ascending buried the busiest groups at the bottom.
      const data = await db.select().from(travelGroups).where(where).orderBy(desc(travelGroups.memberCount));

      // Which of these the viewer has already joined, so the card can offer
      // Leave instead of Join. One query for the whole page, not one per card.
      const viewer = await viewerFromSession();
      let joinedIds = new Set<string>();
      if (viewer && data.length > 0) {
        const rows = await db
          .select({ groupId: groupMembers.groupId, role: groupMembers.role })
          .from(groupMembers)
          .where(
            and(
              eq(groupMembers.userId, viewer.id),
              inArray(groupMembers.groupId, data.map((g) => g.id)),
            ),
          );
        joinedIds = new Set(rows.map((r) => r.groupId));
      }

      return NextResponse.json({
        success: true,
        data: data.map((group) => ({
          ...group,
          tags: JSON.parse(group.tags || "[]"),
          joined: joinedIds.has(group.id),
          isOwner: viewer ? group.createdBy === viewer.id : false,
        })),
      });
    } catch (dbError) {
      return NextResponse.json(
        { success: false, message: (dbError as Error).message },
        { status: 500 },
      );
    }
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
      where: (users, { eq }) => eq(users.email, session.user!.email!),
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
