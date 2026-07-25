/**
 * Central frontend configuration. Every module reads its settings from here
 * instead of touching `process.env` directly, so there is one place to see
 * what the browser bundle depends on.
 *
 * SECURITY: only VITE_-prefixed variables exist in the browser, and only
 * public values belong here. Provider secrets (TomTom, Geoapify, OpenAI, the
 * Supabase service-role key) live in backend/.env and are reached exclusively
 * through the backend proxy.
 */

const readString = (value: unknown, fallback: string) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : fallback;
};

/**
 * Backend API base. `VITE_API_BASE_URL` is the documented name (host root, no
 * `/api`); `VITE_API_URL` is the original name (already includes `/api`) and
 * is still honoured so existing .env files keep working.
 */
const resolveApiUrl = () => {
  const legacy = readString(process.env.NEXT_PUBLIC_API_URL, "");
  if (legacy) return legacy.replace(/\/+$/, "");

  const base = readString(process.env.NEXT_PUBLIC_API_BASE_URL, "");
  return base ? `${base.replace(/\/+$/, "")}/api` : "/api";
};

export type MapProviderId = "osm" | "tomtom";

export const appEnv = {
  /** Fully-qualified API root, e.g. http://localhost:5000/api */
  apiUrl: resolveApiUrl(),

  supabaseUrl: readString(process.env.NEXT_PUBLIC_SUPABASE_URL, ""),
  supabaseAnonKey: readString(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, ""),

  /**
   * Base map provider. "osm" uses OpenStreetMap raster tiles directly;
   * "tomtom" uses the backend tile proxy (keeps the TomTom key server-side).
   */
  mapProvider: readString(process.env.NEXT_PUBLIC_MAP_PROVIDER, "osm") as MapProviderId,

  /** Where the map opens when there is no GPS fix and no saved centre. */
  defaultCenter: {
    lat: Number(process.env.NEXT_PUBLIC_MAP_DEFAULT_LAT ?? 30.3753),
    lng: Number(process.env.NEXT_PUBLIC_MAP_DEFAULT_LNG ?? 69.3451),
    zoom: Number(process.env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM ?? 5),
  },
} as const;

export const supabaseConfigured = Boolean(appEnv.supabaseUrl && appEnv.supabaseAnonKey);
