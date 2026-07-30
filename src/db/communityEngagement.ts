import { and, eq, inArray, sql } from "drizzle-orm";
import { getServerSession } from "next-auth";

import { db } from "./index";
import { communityComments, communityReactions, users } from "./schema";
import { authOptions } from "../app/api/auth/[...nextauth]/route";

export type TargetType = "tip" | "review";
export type ReactionKind = "like" | "bookmark" | "helpful";

export type Engagement = {
  likes: number;
  bookmarks: number;
  helpful: number;
  comments: number;
  /** What the signed-in viewer has done. All false when signed out. */
  viewer: { liked: boolean; bookmarked: boolean; helpful: boolean };
};

export const emptyEngagement = (): Engagement => ({
  likes: 0,
  bookmarks: 0,
  helpful: 0,
  comments: 0,
  viewer: { liked: false, bookmarked: false, helpful: false },
});

/** The signed-in user's row, or null. Every community write needs this. */
export const viewerFromSession = async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const rows = await db.select().from(users).where(eq(users.email, session.user.email)).limit(1);
  return rows[0] ?? null;
};

/**
 * Counts and viewer state for a batch of tips or reviews.
 *
 * Batched deliberately: the obvious per-item version issues three queries per
 * card, so a 20-item feed costs 60 round trips. This is three queries total
 * regardless of feed size.
 */
export const engagementFor = async (
  targetType: TargetType,
  ids: string[],
  viewerId: string | null,
): Promise<Record<string, Engagement>> => {
  const result: Record<string, Engagement> = {};
  for (const id of ids) result[id] = emptyEngagement();
  if (ids.length === 0) return result;

  const [reactionRows, commentRows, viewerRows] = await Promise.all([
    db
      .select({
        targetId: communityReactions.targetId,
        kind: communityReactions.kind,
        count: sql<number>`count(*)::int`,
      })
      .from(communityReactions)
      .where(
        and(eq(communityReactions.targetType, targetType), inArray(communityReactions.targetId, ids)),
      )
      .groupBy(communityReactions.targetId, communityReactions.kind),

    db
      .select({
        targetId: communityComments.targetId,
        count: sql<number>`count(*)::int`,
      })
      .from(communityComments)
      .where(
        and(eq(communityComments.targetType, targetType), inArray(communityComments.targetId, ids)),
      )
      .groupBy(communityComments.targetId),

    viewerId
      ? db
          .select({ targetId: communityReactions.targetId, kind: communityReactions.kind })
          .from(communityReactions)
          .where(
            and(
              eq(communityReactions.targetType, targetType),
              eq(communityReactions.userId, viewerId),
              inArray(communityReactions.targetId, ids),
            ),
          )
      : Promise.resolve([] as Array<{ targetId: string; kind: string }>),
  ]);

  for (const row of reactionRows) {
    const entry = result[row.targetId];
    if (!entry) continue;
    if (row.kind === "like") entry.likes = row.count;
    else if (row.kind === "bookmark") entry.bookmarks = row.count;
    else if (row.kind === "helpful") entry.helpful = row.count;
  }

  for (const row of commentRows) {
    const entry = result[row.targetId];
    if (entry) entry.comments = row.count;
  }

  for (const row of viewerRows) {
    const entry = result[row.targetId];
    if (!entry) continue;
    if (row.kind === "like") entry.viewer.liked = true;
    else if (row.kind === "bookmark") entry.viewer.bookmarked = true;
    else if (row.kind === "helpful") entry.viewer.helpful = true;
  }

  return result;
};
