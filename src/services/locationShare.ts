/**
 * Share where you are.
 *
 * Uses the platform share sheet when it exists (that is what puts the message
 * into WhatsApp, SMS or anything else the phone has), and falls back to the
 * clipboard on desktop browsers that have no share sheet.
 *
 * The link is a plain map URL with coordinates, so the recipient does not need
 * an account or the app installed to see the position.
 */

export type ShareResult = "shared" | "copied" | "unavailable";

const mapLink = (latitude: number, longitude: number, label?: string) => {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
  });
  if (label) params.set("place", label);
  return `${origin}/map?${params.toString()}`;
};

export const shareLocation = async (input: {
  latitude: number;
  longitude: number;
  label?: string;
  note?: string;
}): Promise<ShareResult> => {
  const { latitude, longitude, label, note } = input;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "unavailable";

  const url = mapLink(latitude, longitude, label);
  const title = label ? `My location: ${label}` : "My location";
  // Coordinates go in the text as well as the link — a recipient can paste
  // them into any map app even if they never open the URL.
  const text = [note, `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`].filter(Boolean).join(" — ");

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (error) {
      // AbortError means the user dismissed the sheet on purpose; that is not
      // a failure and must not fall through to silently copying instead.
      if (error instanceof Error && error.name === "AbortError") return "shared";
    }
  }

  try {
    await navigator.clipboard.writeText(`${title}\n${text}\n${url}`);
    return "copied";
  } catch {
    return "unavailable";
  }
};

/** A `tel:` link for a contact, so the phone's own dialer handles the call. */
export const dialLink = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

/** Pre-filled SMS to a contact — again handed to the phone, not sent by us. */
export const smsLink = (phone: string, body: string) =>
  `sms:${phone.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(body)}`;
