import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../../db";
import { communityTips } from "../../../../db/schema";
import { desc, eq } from "drizzle-orm";
import { engagementFor, emptyEngagement, viewerFromSession } from "../../../../db/communityEngagement";

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
      // Drizzle's select builder returns a different type from .where(), so a
      // reassigned `let` does not typecheck. Decide the condition first.
      const where = category && category !== "all" ? eq(communityTips.category, category) : undefined;
      // Newest first. Ascending put the oldest tip at the top of the feed,
      // so a new post appeared at the bottom and looked like it had failed.
      const data = await db
        .select()
        .from(communityTips)
        .where(where)
        .orderBy(desc(communityTips.createdAt));

      // Counts come from community_reactions/community_comments, not the
      // stale integer columns on this table.
      const viewer = await viewerFromSession();
      const engagement = await engagementFor("tip", data.map((t) => t.id), viewer?.id ?? null);

      return NextResponse.json({
        success: true,
        data: data.map((tip) => ({ ...tip, engagement: engagement[tip.id] ?? emptyEngagement() })),
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
