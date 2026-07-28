import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq, sql } from "drizzle-orm";

import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../../db";
import { roadAlerts } from "../../../../../db/schema";

export const dynamic = "force-dynamic";

/**
 * "This alert is still there" — a community confirmation.
 *
 * `roadAlertsService.confirm()` has always called this path and the route did
 * not exist, so the map's confirm button returned 404 every time. Same for
 * ../resolve.
 *
 * The increment runs in SQL rather than read-modify-write so two people
 * confirming at once cannot overwrite each other's vote.
 */
export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, message: "Sign in to confirm alerts." }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const updated = await db
      .update(roadAlerts)
      .set({
        upvotes: sql`${roadAlerts.upvotes} + 1`,
        // A confirmation revives an alert someone had marked resolved.
        status: "active",
      })
      .where(eq(roadAlerts.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ success: false, message: "Alert not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
