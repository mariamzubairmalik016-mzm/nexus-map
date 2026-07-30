import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../../../../db";
import { groupMembers, travelGroups } from "../../../../../db/schema";
import { viewerFromSession } from "../../../../../db/communityEngagement";

export const dynamic = "force-dynamic";

/**
 * Join and leave a travel group.
 *
 * `group_members` existed and group creation already inserted the creator as
 * admin, but there was no way for anyone else to join — the "Join Group"
 * button in the feed had no handler at all.
 *
 * `travel_groups.member_count` is kept in step with the rows here rather than
 * trusted on its own, so the number on the card is always what the membership
 * table actually contains.
 */

const BodySchema = z.object({ groupId: z.string().trim().min(1) });

const recountMembers = async (groupId: string) => {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));

  await db.update(travelGroups).set({ memberCount: count }).where(eq(travelGroups.id, groupId));
  return count;
};

export async function POST(req: NextRequest) {
  const viewer = await viewerFromSession();
  if (!viewer) {
    return NextResponse.json({ success: false, message: "Sign in to join a group." }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "A group id is required." }, { status: 400 });
  }

  try {
    const group = await db
      .select()
      .from(travelGroups)
      .where(eq(travelGroups.id, parsed.data.groupId))
      .limit(1);

    if (group.length === 0) {
      return NextResponse.json({ success: false, message: "Group not found." }, { status: 404 });
    }

    const already = await db
      .select()
      .from(groupMembers)
      .where(
        and(eq(groupMembers.groupId, parsed.data.groupId), eq(groupMembers.userId, viewer.id)),
      )
      .limit(1);

    if (already.length === 0) {
      await db.insert(groupMembers).values({
        groupId: parsed.data.groupId,
        userId: viewer.id,
        role: "member",
      });
    }

    const memberCount = await recountMembers(parsed.data.groupId);
    return NextResponse.json({ success: true, data: { joined: true, memberCount } });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const viewer = await viewerFromSession();
  if (!viewer) {
    return NextResponse.json({ success: false, message: "Sign in to leave a group." }, { status: 401 });
  }

  const groupId = new URL(req.url).searchParams.get("groupId");
  if (!groupId) {
    return NextResponse.json({ success: false, message: "A group id is required." }, { status: 400 });
  }

  try {
    const membership = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, viewer.id)))
      .limit(1);

    // The last admin leaving would strand the group with no one able to
    // manage it, so that is refused rather than silently allowed.
    if (membership[0]?.role === "admin") {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.role, "admin")));

      if (count <= 1) {
        return NextResponse.json(
          { success: false, message: "You are the only admin — make someone else an admin first." },
          { status: 409 },
        );
      }
    }

    await db
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, viewer.id)));

    const memberCount = await recountMembers(groupId);
    return NextResponse.json({ success: true, data: { joined: false, memberCount } });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
