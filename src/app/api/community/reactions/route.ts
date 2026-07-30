import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../../../db";
import { communityReactions } from "../../../../db/schema";
import { viewerFromSession } from "../../../../db/communityEngagement";

export const dynamic = "force-dynamic";

/**
 * Toggle a like / bookmark / helpful vote.
 *
 * The UI previously rendered these as static numbers with no handler at all,
 * on top of counter columns that recorded no owner. Reacting is now a row, so
 * the same tap can undo itself and the count is whatever the table says.
 */

const ToggleSchema = z.object({
  targetType: z.enum(["tip", "review"]),
  targetId: z.string().trim().min(1),
  kind: z.enum(["like", "bookmark", "helpful"]),
});

export async function POST(req: NextRequest) {
  const viewer = await viewerFromSession();
  if (!viewer) {
    return NextResponse.json({ success: false, message: "Sign in to react." }, { status: 401 });
  }

  const parsed = ToggleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid reaction." }, { status: 400 });
  }

  const { targetType, targetId, kind } = parsed.data;

  try {
    const match = and(
      eq(communityReactions.targetType, targetType),
      eq(communityReactions.targetId, targetId),
      eq(communityReactions.userId, viewer.id),
      eq(communityReactions.kind, kind),
    );

    const existing = await db.select().from(communityReactions).where(match).limit(1);

    let active: boolean;
    if (existing.length > 0) {
      await db.delete(communityReactions).where(match);
      active = false;
    } else {
      // The unique index is the real guard. A double-tap that races past the
      // select above lands here twice; the second insert violates the index
      // rather than creating a duplicate, and the state is already correct.
      await db
        .insert(communityReactions)
        .values({ targetType, targetId, userId: viewer.id, kind })
        .onConflictDoNothing();
      active = true;
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(communityReactions)
      .where(
        and(
          eq(communityReactions.targetType, targetType),
          eq(communityReactions.targetId, targetId),
          eq(communityReactions.kind, kind),
        ),
      );

    return NextResponse.json({ success: true, data: { active, count } });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
