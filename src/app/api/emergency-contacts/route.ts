import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { authOptions } from "../auth/[...nextauth]/route";
import { db } from "../../../db";
import { emergencyContacts, users } from "../../../db/schema";

export const dynamic = "force-dynamic";

/**
 * Emergency contacts.
 *
 * The `emergency_contacts` table shipped with the schema and `/api/sos` reads
 * from it, but nothing could ever write to it — the Safety Centre held its
 * contacts in a `useState([])` that was never populated, so the SOS flow
 * always had an empty recipient list. This is the missing write path.
 */

const ContactSchema = z.object({
  name: z.string().trim().min(1, "A name is required.").max(120),
  phone: z.string().trim().min(3, "A phone number is required.").max(50),
  relationship: z.string().trim().max(80).optional(),
  isPrimary: z.boolean().optional(),
});

const currentUser = async (email: string) => {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
};

const unauthorised = () =>
  NextResponse.json({ success: false, message: "Sign in to manage emergency contacts." }, { status: 401 });

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return unauthorised();

  try {
    const user = await currentUser(session.user.email);
    if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });

    const rows = await db
      .select()
      .from(emergencyContacts)
      .where(eq(emergencyContacts.userId, user.id))
      // Primary first, then oldest first, so the list order is stable between
      // loads rather than however Postgres happens to return it.
      .orderBy(desc(emergencyContacts.isPrimary), asc(emergencyContacts.createdAt));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return unauthorised();

  const parsed = ContactSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Invalid contact." },
      { status: 400 },
    );
  }

  try {
    const user = await currentUser(session.user.email);
    if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });

    // Exactly one primary. Demote the rest first, otherwise SOS has no single
    // contact to reach for when it needs the most important one.
    if (parsed.data.isPrimary) {
      await db
        .update(emergencyContacts)
        .set({ isPrimary: 0 })
        .where(eq(emergencyContacts.userId, user.id));
    }

    const inserted = await db
      .insert(emergencyContacts)
      .values({
        userId: user.id,
        name: parsed.data.name,
        phone: parsed.data.phone,
        relationship: parsed.data.relationship || null,
        isPrimary: parsed.data.isPrimary ? 1 : 0,
      })
      .returning();

    return NextResponse.json({ success: true, data: inserted[0] });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return unauthorised();

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ success: false, message: "A contact id is required." }, { status: 400 });
  }

  try {
    const user = await currentUser(session.user.email);
    if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });

    // Scoped to the caller: an id alone must not be enough to delete someone
    // else's contact.
    const removed = await db
      .delete(emergencyContacts)
      .where(and(eq(emergencyContacts.id, id), eq(emergencyContacts.userId, user.id)))
      .returning();

    if (removed.length === 0) {
      return NextResponse.json({ success: false, message: "Contact not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { removed: removed.length } });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
