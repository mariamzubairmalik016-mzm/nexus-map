import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../../../db";
import { communityComments } from "../../../../db/schema";
import { viewerFromSession } from "../../../../db/communityEngagement";

export const dynamic = "force-dynamic";

/**
 * Comments on a tip or a review.
 *
 * The feed rendered `{(tip.comments || []).length}` against a field nothing
 * ever populated, so every card showed 0 and there was no way to write one.
 */

const TargetSchema = z.object({
  targetType: z.enum(["tip", "review"]),
  targetId: z.string().trim().min(1),
});

const CreateSchema = TargetSchema.extend({
  content: z.string().trim().min(1, "Write something first.").max(1000),
});

/** Thread for one target, oldest first so a conversation reads top-down. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = TargetSchema.safeParse({
    targetType: searchParams.get("targetType"),
    targetId: searchParams.get("targetId"),
  });
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid target." }, { status: 400 });
  }

  try {
    const viewer = await viewerFromSession();
    const rows = await db
      .select()
      .from(communityComments)
      .where(
        and(
          eq(communityComments.targetType, parsed.data.targetType),
          eq(communityComments.targetId, parsed.data.targetId),
        ),
      )
      .orderBy(asc(communityComments.createdAt));

    // `mine` lets the client show a delete control without leaking user ids.
    const data = rows.map((row) => ({
      id: row.id,
      userName: row.userName,
      content: row.content,
      createdAt: row.createdAt,
      mine: viewer ? row.userId === viewer.id : false,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const viewer = await viewerFromSession();
  if (!viewer) {
    return NextResponse.json({ success: false, message: "Sign in to comment." }, { status: 401 });
  }

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Invalid comment." },
      { status: 400 },
    );
  }

  try {
    const inserted = await db
      .insert(communityComments)
      .values({
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        userId: viewer.id,
        // Identity comes from the session, never from the request body — the
        // client cannot post as someone else.
        userName: viewer.name || viewer.email?.split("@")[0] || "Traveller",
        content: parsed.data.content,
      })
      .returning();

    const row = inserted[0];
    return NextResponse.json(
      {
        success: true,
        data: {
          id: row.id,
          userName: row.userName,
          content: row.content,
          createdAt: row.createdAt,
          mine: true,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}

/** Delete your own comment. */
export async function DELETE(req: NextRequest) {
  const viewer = await viewerFromSession();
  if (!viewer) {
    return NextResponse.json({ success: false, message: "Sign in to delete." }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ success: false, message: "A comment id is required." }, { status: 400 });
  }

  try {
    // Scoped to the author: an id alone must not delete someone else's comment.
    const removed = await db
      .delete(communityComments)
      .where(and(eq(communityComments.id, id), eq(communityComments.userId, viewer.id)))
      .returning();

    if (removed.length === 0) {
      return NextResponse.json({ success: false, message: "Comment not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { removed: removed.length } });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
