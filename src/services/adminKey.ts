import { timingSafeEqual } from "crypto";

/**
 * Admin access key.
 *
 * Lets someone register as an admin from anywhere by entering a shared code at
 * signup, instead of an existing admin having to promote them by hand in the
 * database.
 *
 * The key lives only in `ADMIN_SIGNUP_KEY` on the server. It is never sent to
 * the browser and never appears in an API response — the signup form posts a
 * candidate and gets back only the role it was granted.
 *
 * Understand the tradeoff before relying on this: it is ONE shared secret with
 * no expiry and no per-person tracking. Anyone who learns it — forwarded
 * message, screenshot, shoulder-surf — can create admin accounts indefinitely,
 * and you cannot tell afterwards which of them used it. Rotating it means
 * changing the env var, which invalidates it for everyone at once. For a small
 * trusted team that is a reasonable trade; for anything larger, per-person
 * invite tokens stored in the database are the right shape.
 */

/** Minimum length we will accept as configured, to rule out a trivial key. */
const MIN_KEY_LENGTH = 12;

export const adminKeyConfigured = (): boolean => {
  const key = process.env.ADMIN_SIGNUP_KEY;
  return typeof key === "string" && key.trim().length >= MIN_KEY_LENGTH;
};

/**
 * Constant-time comparison.
 *
 * `===` on secrets leaks their content: it returns as soon as two characters
 * differ, so response time reveals how many leading characters were correct
 * and the key can be recovered one character at a time. Comparing fixed-length
 * SHA-equivalents byte-by-byte takes the same time whatever the input.
 */
export const isValidAdminKey = (candidate: unknown): boolean => {
  const expected = process.env.ADMIN_SIGNUP_KEY;
  if (typeof expected !== "string" || expected.trim().length < MIN_KEY_LENGTH) return false;
  if (typeof candidate !== "string") return false;

  const a = Buffer.from(candidate.trim(), "utf8");
  const b = Buffer.from(expected.trim(), "utf8");

  // timingSafeEqual throws on length mismatch, and the throw itself would leak
  // length. Compare into equal-size buffers so every path costs the same.
  const size = Math.max(a.length, b.length, 1);
  const padded = (buf: Buffer) => {
    const out = Buffer.alloc(size);
    buf.copy(out);
    return out;
  };

  return timingSafeEqual(padded(a), padded(b)) && a.length === b.length;
};
