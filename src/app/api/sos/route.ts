import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { desc, eq, and } from "drizzle-orm";
import { z } from "zod";

import { authOptions } from "../auth/[...nextauth]/route";
import { db } from "../../../db";
import { sosAlerts, users, emergencyContacts } from "../../../db/schema";

export const dynamic = "force-dynamic";

/**
 * Emergency alerts.
 *
 * The `sos_alerts` table has existed since the schema was written but nothing
 * ever read or wrote it — the Safety Centre's SOS button was a local state
 * change. An emergency feature that only updates the screen is worse than no
 * button at all, because it implies help was summoned.
 *
 * A raised alert is a real row: it persists, it is visible to admins, and it
 * stays open until it is explicitly resolved.
 */

const RaiseSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  message: z.string().trim().max(500).optional(),
});

const currentUser = async (email: string) => {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
};

/** Active alerts for the signed-in user, plus their emergency contacts. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, message: "Sign in to use SOS." }, { status: 401 });
  }

  try {
    const user = await currentUser(session.user.email);
    if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });

    const [active, contacts] = await Promise.all([
      db
        .select()
        .from(sosAlerts)
        .where(and(eq(sosAlerts.userId, user.id), eq(sosAlerts.status, "active")))
        .orderBy(desc(sosAlerts.createdAt)),
      db.select().from(emergencyContacts).where(eq(emergencyContacts.userId, user.id)),
    ]);

    return NextResponse.json({ success: true, data: { active, contacts } });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}

/** Raise an SOS at a coordinate. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, message: "Sign in to use SOS." }, { status: 401 });
  }

  const parsed = RaiseSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "A valid location is required to raise an alert." },
      { status: 400 },
    );
  }

  try {
    const user = await currentUser(session.user.email);
    if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });

    // Don't stack duplicates: pressing SOS twice should keep one open alert,
    // not create a second one that has to be resolved separately.
    const open = await db
      .select()
      .from(sosAlerts)
      .where(and(eq(sosAlerts.userId, user.id), eq(sosAlerts.status, "active")))
      .limit(1);

    if (open.length > 0) {
      const updated = await db
        .update(sosAlerts)
        .set({
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
          message: parsed.data.message ?? open[0].message,
        })
        .where(eq(sosAlerts.id, open[0].id))
        .returning();

      return NextResponse.json({ success: true, data: updated[0], meta: { updated: true } });
    }

    const inserted = await db
      .insert(sosAlerts)
      .values({
        userId: user.id,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        message: parsed.data.message || null,
        status: "active",
      })
      .returning();

    const contacts = await db
      .select()
      .from(emergencyContacts)
      .where(eq(emergencyContacts.userId, user.id));

    return NextResponse.json({
      success: true,
      data: inserted[0],
      // The app cannot send an SMS by itself. Returning the contacts lets the
      // UI open the phone's own dialer/messaging app, which is honest about
      // who actually delivers the message.
      meta: { contacts },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}

/** Stand down — mark the caller's active alert resolved. */
export async function PATCH() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, message: "Sign in to use SOS." }, { status: 401 });
  }

  try {
    const user = await currentUser(session.user.email);
    if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });

    const updated = await db
      .update(sosAlerts)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(and(eq(sosAlerts.userId, user.id), eq(sosAlerts.status, "active")))
      .returning();

    return NextResponse.json({ success: true, data: { resolved: updated.length } });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
