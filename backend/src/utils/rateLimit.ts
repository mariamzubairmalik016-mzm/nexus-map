// Simple in-memory sliding-window rate limiter shared across routes.
const hits = new Map<string, number[]>();

export const rateLimit = (key: string, max: number, windowMs: number) => {
  const current = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => current - t < windowMs);
  if (recent.length >= max) return false;
  recent.push(current);
  hits.set(key, recent);
  return true;
};
