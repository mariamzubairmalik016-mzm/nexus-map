import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "../../../../db";
import { users, profiles } from "../../../../db/schema";

export const dynamic = "force-dynamic";

/**
 * Account creation.
 *
 * Two things this route used to get wrong:
 *
 *   1. No validation. "notanemail" and a one-character password both returned
 *      201, so unusable accounts were written to the database.
 *   2. It inserted into `user` but never into `profiles`. Six of the eight
 *      existing users had no profile row. Since the NextAuth `jwt` callback
 *      reads `role` from `profiles`, those accounts could never hold a role —
 *      admin@nexusmap.com could not actually be an admin.
 */

const SignupSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(80),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password is too long."),
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = SignupSchema.safeParse(body);

    if (!parsed.success) {
      // Surface the first message directly — the form shows it verbatim, so it
      // needs to read as a sentence, not as a schema dump.
      const message = parsed.error.issues[0]?.message || "Please check your details.";
      return NextResponse.json({ message }, { status: 400 });
    }

    const { name, email, password } = parsed.data;

    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { message: "An account with that email already exists." },
        { status: 409 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const inserted = await db
      .insert(users)
      .values({ name, email, password: hashedPassword })
      .returning({ id: users.id });

    const userId = inserted[0]?.id;

    // The profile carries the role, so it has to exist from the moment the
    // account does. Without it the account can never be promoted — which is
    // exactly the state the existing rows were in.
    if (userId) {
      await db
        .insert(profiles)
        .values({ id: userId, fullName: name, email, role: "user" })
        .onConflictDoNothing();
    }

    return NextResponse.json({ message: "Account created successfully." }, { status: 201 });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}
