import { DESTINATION_IMAGES } from "../data/destinationImages";

export const FALLBACK_IMAGE = "/destinations/karachi.jpg";

/**
 * Resolves a destination to its own local image. Exact name match first, then
 * the leading token (so "Hunza Valley" -> hunza, "Dubai Marina" -> dubai), then
 * the database URL, then a graceful fallback. Never assigns a random image.
 */
export const destinationImage = (name?: string | null, dbUrl?: string | null): string => {
  if (name) {
    const normalized = name.toLowerCase().trim();
    if (DESTINATION_IMAGES[normalized]) return DESTINATION_IMAGES[normalized];
    const first = normalized.split(/[\s,]+/)[0];
    if (first && DESTINATION_IMAGES[first]) return DESTINATION_IMAGES[first];
  }
  return dbUrl || FALLBACK_IMAGE;
};
