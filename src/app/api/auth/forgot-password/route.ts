import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../../../db";
import { users, verificationTokens } from "../../../../db/schema";

export const dynamic = "force-dynamic";

/**
 * Start a password reset.
 *
 * The page previously just fired `toast.success("Reset link sent (demo mode)")`
 * — no token, no record, nothing to reset with. This issues a real single-use
 * token against the existing `verificationToken` table.
 *
 * Email delivery is the one part that cannot be completed here: no mail
 * provider is configured. Rather than pretend, the link is logged to the
 * server console (and returned in the response in development only) so the
 * flow is fully testable now, and sending becomes a small addition once SMTP
 * credentials exist.
 */

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const Schema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

/** Store a hash, never the raw token — a DB leak must not grant resets. */
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);

  // Deliberately identical response whether or not the address exists, so this
  // endpoint cannot be used to discover which emails have accounts.
  const genericOk = NextResponse.json({
    success: true,
    message: "If that email has an account, a reset link is on its way.",
  });

  if (!parsed.success) return genericOk;

  try {
    const { email } = parsed.data;
    const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = found[0];
    if (!user) return genericOk;

    const rawToken = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + TOKEN_TTL_MS);

    await db.insert(verificationTokens).values({
      identifier: email,
      token: hash(rawToken),
      expires,
    });

    const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const link = `${base}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

    // TODO: send `link` by email once a mail provider is configured.
    console.info(`[auth] password reset link for ${email}: ${link}`);

    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({
        success: true,
        message: "Reset link generated. Email delivery is not configured, so use the link below.",
        data: { link },
      });
    }

    return genericOk;
  } catch (error) {
    console.error("[auth] forgot-password failed:", error);
    return genericOk;
  }
}
