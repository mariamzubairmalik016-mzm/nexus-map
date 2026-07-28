import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Which required configuration is missing on THIS deployment.
 *
 * Exists because a missing environment variable on the host presents as an
 * opaque 500 with no indication of the cause. The specific failure that led
 * here: `.env.local` is gitignored — correctly, it holds secrets — so a Vercel
 * deployment never receives any of it. Without NEXTAUTH_SECRET, NextAuth
 * throws in production and every sign-in and sign-up returns 500, while the
 * developer's own machine keeps working because NextAuth derives a secret in
 * development. The result looks like "auth only works for me".
 *
 * Reports presence only — never a value, never a prefix, never a length.
 * Knowing that TOMTOM_API_KEY is set tells an attacker nothing; printing four
 * characters of it would.
 */

type Requirement = {
  name: string;
  /** What stops working when this is missing. */
  breaks: string;
  required: boolean;
};

const REQUIREMENTS: Requirement[] = [
  { name: "DATABASE_URL", breaks: "All accounts, saved places, routes, alerts", required: true },
  { name: "NEXTAUTH_SECRET", breaks: "Sign in and sign up (500 in production)", required: true },
  { name: "NEXTAUTH_URL", breaks: "OAuth callbacks and session cookies", required: true },
  { name: "TOMTOM_API_KEY", breaks: "Map tiles, routing, traffic", required: true },
  { name: "GEOAPIFY_API_KEY", breaks: "Local area search, tourism places", required: false },
  { name: "GOOGLE_CLIENT_ID", breaks: "Google sign-in button (hidden without it)", required: false },
  { name: "GOOGLE_CLIENT_SECRET", breaks: "Google sign-in button (hidden without it)", required: false },
  { name: "OPENROUTER_API_KEY", breaks: "AI chat and AI-written trip narratives", required: false },
  { name: "ADMIN_SIGNUP_KEY", breaks: "Creating an admin account at signup", required: false },
];

export async function GET() {
  const checks = REQUIREMENTS.map((r) => ({
    name: r.name,
    required: r.required,
    // Presence only. A variable set to an empty string counts as missing,
    // because that is how a blank field in a hosting dashboard arrives.
    present: typeof process.env[r.name] === "string" && process.env[r.name]!.trim().length > 0,
    breaks: r.breaks,
  }));

  const missingRequired = checks.filter((c) => c.required && !c.present);
  const missingOptional = checks.filter((c) => !c.required && !c.present);

  return NextResponse.json({
    success: true,
    data: {
      healthy: missingRequired.length === 0,
      environment: process.env.NODE_ENV,
      // NEXTAUTH_URL must match the deployed origin or OAuth callbacks fail.
      // Reported because a localhost value on a live site is a common cause.
      nextAuthUrl: process.env.NEXTAUTH_URL ?? null,
      vercelUrl: process.env.VERCEL_URL ?? null,
      missingRequired: missingRequired.map((c) => ({ name: c.name, breaks: c.breaks })),
      missingOptional: missingOptional.map((c) => ({ name: c.name, breaks: c.breaks })),
      checks,
    },
  });
}
