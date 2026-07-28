import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq, sql } from "drizzle-orm";

import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../../db";
import { roadAlerts } from "../../../../../db/schema";

export const dynamic = "force-dynamic";

/** Threshold at which community reports close an alert outright. */
const RESOLVE_AT_DOWNVOTES = 3;

/**
 * "This is cleared now" — the counterpart to ../confirm, which was also
 * missing, so the map's resolve button 404'd.
 *
 * A single report does not close an alert: one person driving past a cleared
 * lane is not proof the road is open, and letting one vote erase a hazard
 * others are relying on is the wrong default. The alert closes once enough
 * people agree, or immediately if the person who reported it says so.
 */
export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, message: "Sign in to update alerts." }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const rows = await db.select().from(roadAlerts).where(eq(roadAlerts.id, id)).limit(1);
    const alert = rows[0];
    if (!alert) {
      return NextResponse.json({ success: false, message: "Alert not found." }, { status: 404 });
    }

    const reporter = await db.query.users.findFirst({
      where: (users, { eq: matches }) => matches(users.email, session.user!.email!),
    });
    const isOwner = reporter?.id === alert.userId;
    const willClose = isOwner || alert.downvotes + 1 >= RESOLVE_AT_DOWNVOTES;

    const updated = await db
      .update(roadAlerts)
      .set({
        downvotes: sql`${roadAlerts.downvotes} + 1`,
        status: willClose ? "resolved" : alert.status,
      })
      .where(eq(roadAlerts.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      data: updated[0],
      meta: {
        closed: willClose,
        // Lets the UI say "2 more reports needed" instead of appearing to do
        // nothing when a vote is recorded but the alert stays up.
        remaining: willClose ? 0 : Math.max(0, RESOLVE_AT_DOWNVOTES - (alert.downvotes + 1)),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
