/**
 * Pin NextAuth to a STABLE URL when running on Vercel.
 *
 * NextAuth builds the OAuth callback from `NEXTAUTH_URL`, and Google matches
 * redirect URIs exactly — no wildcards. This previously used `VERCEL_URL`,
 * which is the *per-deployment* host (`nexus-ow2eg8an5-….vercel.app`) and is
 * different on every single deploy. So the callback Google was sent could
 * never be one of the registered URIs, and re-registering after each deploy
 * would be the only way to keep it working. That is why Google sign-in fails
 * on the deployed site while email/password keeps working.
 *
 * Order of preference:
 *   1. `NEXTAUTH_URL`, when it has actually been set to the live domain.
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` — Vercel's stable production host.
 *   3. `VERCEL_URL` as a last resort, so the app still runs; Google sign-in
 *      will not work on that URL, but nothing else breaks.
 *
 * Untouched off Vercel, where `NEXTAUTH_URL=http://localhost:3000` is right.
 */
/**
 * A value pasted into a hosting dashboard very often arrives with a trailing
 * newline, and this deployment had exactly that: `NEXTAUTH_URL` was
 * "https://nexus-map-pi.vercel.app\n". `new URL()` rejects it, so NextAuth
 * silently discarded it and inferred the origin from the request headers —
 * which on Vercel is the *per-deployment* host, different on every deploy and
 * therefore impossible to register with Google. Sign-in worked for whoever
 * already held a session cookie and for nobody else.
 *
 * Trimmed and validated here rather than trusted, because the same paste
 * mistake will happen again and it presents as an unexplained auth failure.
 */
const cleanOrigin = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    // `origin` also drops any stray path or trailing slash.
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
};

if (process.env.VERCEL) {
  const configured = cleanOrigin(process.env.NEXTAUTH_URL);
  const usable = configured && !/localhost|127\.0\.0\.1/.test(configured);

  // Write the cleaned value back so NextAuth reads a URL it can actually parse.
  if (usable) process.env.NEXTAUTH_URL = configured!;

  if (!usable) {
    const stable = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const host = stable || process.env.VERCEL_URL;

    if (host) {
      process.env.NEXTAUTH_URL = `https://${host}`;
      if (!stable) {
        console.warn(
          "[auth] Falling back to this deployment's own URL. Google sign-in needs a " +
            "stable domain — set NEXTAUTH_URL in the Vercel project settings.",
        );
      }
    }
  }
}

import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "../../../../db";
import { users, profiles } from "../../../../db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

/**
 * Google sign-in is only registered when both credentials are present.
 *
 * NextAuth throws at import time if a provider is configured with an undefined
 * clientId, which would take down every auth route — including email/password
 * login — for anyone who has not set up OAuth. Registering conditionally keeps
 * the app working without Google and lights it up the moment the two variables
 * exist.
 */
const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const authOptions: AuthOptions = {
  adapter: DrizzleAdapter(db) as any,
  session: { strategy: "jwt" },
  /**
   * Stated explicitly rather than left to NextAuth's implicit lookup.
   *
   * In development NextAuth derives a secret when none is set, so sign-in works
   * on a laptop. In production it throws instead, and every auth route — sign
   * in, sign up, session — returns a 500. The symptom is the confusing one
   * this deployment hit: authentication works for the developer locally and
   * for nobody at all on the deployed site.
   *
   * Reading it here means a missing value shows up in the startup log and in
   * /api/health/env as a named missing variable, instead of as an opaque 500.
   */
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    ...(googleEnabled
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            // `consent` + offline is what actually returns a refresh token;
            // without it a re-signin yields only a short-lived access token.
            authorization: {
              params: { prompt: "consent", access_type: "offline", response_type: "code" },
            },
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        // Find the user in the database
        const result = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email))
          .limit(1);
          
        const user = result[0];
        
        if (!user || !user.password) {
          throw new Error("No user found with this email.");
        }
        
        // Verify the password securely
        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          throw new Error("Invalid password.");
        }
        
        // Fetch role from profiles table
        const profileResult = await db
          .select()
          .from(profiles)
          .where(eq(profiles.id, user.id))
          .limit(1);
        const role = profileResult[0]?.role || "user";
        
        return { id: user.id, name: user.name, email: user.email, role };
      },
    }),
  ],
  callbacks: {
    /**
     * Make sure every account has a profile row, whichever way they signed in.
     *
     * The credentials flow creates one at signup, but a Google user is created
     * by the adapter, which knows nothing about `profiles`. Without this, OAuth
     * accounts would land in the same broken state the old signup route left
     * behind: a user with no row to hold their role.
     */
    async signIn({ user }) {
      if (!user?.id || !user.email) return true;
      try {
        await db
          .insert(profiles)
          .values({
            id: user.id,
            fullName: user.name || user.email.split("@")[0],
            email: user.email,
            avatarUrl: user.image ?? null,
            role: "user",
          })
          .onConflictDoNothing();
      } catch (error) {
        // A missing profile must not block sign-in; the jwt callback already
        // falls back to "user" when the row is absent.
        console.warn("[auth] could not ensure profile row:", error);
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
      } else if (!token.role && token.sub) {
        // Ensure OAuth users or existing sessions also get their role
        const p = await db.query.profiles.findFirst({
          where: (profiles, { eq }) => eq(profiles.id, token.sub!)
        });
        token.role = p?.role || "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.sub;
      }
      return session;
    }
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
