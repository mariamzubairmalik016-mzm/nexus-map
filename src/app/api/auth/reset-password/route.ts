import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { db } from "../../../../db";
import { users, verificationTokens } from "../../../../db/schema";

export const dynamic = "force-dynamic";

/**
 * Complete a password reset.
 *
 * Replaces a handler whose entire body was a success toast — the password was
 * never changed. This verifies the token, checks it has not expired, writes a
 * new bcrypt hash, and deletes the token so a link works exactly once.
 */

const Schema = z.object({
  token: z.string().trim().min(16, "This reset link is not valid."),
  email: z.string().trim().toLowerCase().email("This reset link is not valid."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message || "Invalid request." },
      { status: 400 },
    );
  }

  const { token, email, password } = parsed.data;

  try {
    const rows = await db
      .select()
      .from(verificationTokens)
      .where(and(eq(verificationTokens.identifier, email), eq(verificationTokens.token, hash(token))))
      .limit(1);

    const record = rows[0];
    if (!record) {
      return NextResponse.json(
        { success: false, message: "This reset link is invalid or has already been used." },
        { status: 400 },
      );
    }

    if (record.expires.getTime() < Date.now()) {
      // Clear it out so an expired row cannot linger and be retried.
      await db
        .delete(verificationTokens)
        .where(and(eq(verificationTokens.identifier, email), eq(verificationTokens.token, record.token)));
      return NextResponse.json(
        { success: false, message: "This reset link has expired. Please request a new one." },
        { status: 400 },
      );
    }

    const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = found[0];
    if (!user) {
      return NextResponse.json({ success: false, message: "Account not found." }, { status: 404 });
    }

    await db
      .update(users)
      .set({ password: await bcrypt.hash(password, 10) })
      .where(eq(users.id, user.id));

    // Single use: consume the token whether or not anything else follows.
    await db
      .delete(verificationTokens)
      .where(and(eq(verificationTokens.identifier, email), eq(verificationTokens.token, record.token)));

    return NextResponse.json({ success: true, message: "Password updated. You can sign in now." });
  } catch (error) {
    console.error("[auth] reset-password failed:", error);
    return NextResponse.json({ success: false, message: "Could not reset the password." }, { status: 500 });
  }
}
