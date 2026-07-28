import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { authOptions } from "../auth/[...nextauth]/route";
import { db } from "../../../db";
import { profiles, users } from "../../../db/schema";

export const dynamic = "force-dynamic";

/**
 * The signed-in user's profile.
 *
 * The Profile page had no backend at all. It rendered `city: "Karachi"` and
 * `country: "Pakistan"` as hardcoded literals, and its save handler was:
 *
 *     await new Promise((r) => setTimeout(r, 500));
 *     toast.success("Profile updated.");
 *
 * — an artificial delay to imitate a network call, then a success message for
 * something that never happened. Nothing was ever written or read.
 */

const ProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your name.").max(80),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  country: z.string().trim().max(100).optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  bio: z.string().trim().max(500).optional().or(z.literal("")),
});

/** Resolve the session email to a user row. */
const currentUser = async (email: string) => {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  }

  try {
    const user = await currentUser(session.user.email);
    if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });

    const rows = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
    const profile = rows[0];

    // Signup and the OAuth signIn callback both create a profile now, but an
    // account predating that still needs a sane shape rather than a 404.
    return NextResponse.json({
      success: true,
      data: {
        fullName: profile?.fullName ?? user.name ?? "",
        email: profile?.email ?? user.email,
        city: profile?.city ?? "",
        country: profile?.country ?? "",
        phone: profile?.phone ?? "",
        bio: profile?.bio ?? "",
        avatarUrl: profile?.avatarUrl ?? user.image ?? null,
        role: profile?.role ?? "user",
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message || "Please check your details." },
      { status: 400 },
    );
  }

  try {
    const user = await currentUser(session.user.email);
    if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });

    const { fullName, city, country, phone, bio } = parsed.data;

    // `role` is deliberately absent from the schema — a user must not be able
    // to promote themselves by POSTing a role field.
    const values = {
      fullName,
      city: city || null,
      country: country || null,
      phone: phone || null,
      bio: bio || null,
    };

    await db
      .insert(profiles)
      .values({ id: user.id, email: user.email!, ...values })
      .onConflictDoUpdate({ target: profiles.id, set: values });

    // Keep the NextAuth user row in step so the navbar name updates too.
    if (user.name !== fullName) {
      await db.update(users).set({ name: fullName }).where(eq(users.id, user.id));
    }

    return NextResponse.json({ success: true, data: { ...values, email: user.email } });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
