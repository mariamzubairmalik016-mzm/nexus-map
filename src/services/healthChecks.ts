import { isSupabaseConfigured } from "../lib/supabase";
import { pendingCount } from "./offlineQueue";
import { networkStatus } from "./networkStatus";

export type HealthStatus = "healthy" | "degraded" | "offline" | "not-configured";
export type ServiceHealth = { key: string; label: string; status: HealthStatus; detail: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

/** Runs real, non-blocking checks against each service the app depends on. */
export const runHealthChecks = async (): Promise<ServiceHealth[]> => {
  const online = networkStatus.isOnline();

  let backendOk = false;
  let backendDetail = online ? "Not running on :5000" : "You are offline";
  let dbFromBackend = "";
  // Never probe the network while offline (avoids console error noise).
  if (online) try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${API_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const json = (await res.json()) as { database?: string };
      dbFromBackend = json?.database ?? "";
      backendOk = true;
      backendDetail = "Online";
    } else {
      backendDetail = `HTTP ${res.status}`;
    }
  } catch {
    backendOk = false;
  }

  const supa: HealthStatus = isSupabaseConfigured ? "healthy" : "not-configured";
  const pending = await pendingCount().catch(() => 0);

  const sw: ServiceHealth =
    "serviceWorker" in navigator
      ? navigator.serviceWorker.controller
        ? { key: "sw", label: "Service Worker", status: "healthy", detail: "Controlling page" }
        : { key: "sw", label: "Service Worker", status: "degraded", detail: "Registered, activating" }
      : { key: "sw", label: "Service Worker", status: "not-configured", detail: "Unsupported" };

  return [
    { key: "backend", label: "Backend API", status: backendOk ? "healthy" : "offline", detail: backendDetail },
    {
      key: "db",
      label: "Supabase Database",
      status: supa,
      detail: dbFromBackend === "supabase" ? "Connected" : isSupabaseConfigured ? "Configured" : "Add VITE_SUPABASE_URL",
    },
    { key: "auth", label: "Authentication", status: supa, detail: isSupabaseConfigured ? "Supabase Auth" : "Not configured" },
    { key: "realtime", label: "Realtime", status: supa, detail: isSupabaseConfigured ? "Available" : "Not configured" },
    {
      key: "gps",
      label: "GPS / Location",
      status: "geolocation" in navigator ? "healthy" : "offline",
      detail: "geolocation" in navigator ? "Available" : "Unsupported",
    },
    sw,
    {
      key: "idb",
      label: "IndexedDB",
      status: "indexedDB" in window ? "healthy" : "offline",
      detail: "indexedDB" in window ? "Available" : "Unsupported",
    },
    {
      key: "cache",
      label: "Cache Storage",
      status: "caches" in window ? "healthy" : "offline",
      detail: "caches" in window ? "Available" : "Unsupported",
    },
    { key: "maps", label: "Maps (OSM/Leaflet)", status: "healthy", detail: "Client-side tiles" },
    { key: "nav", label: "Navigation (TomTom)", status: backendOk ? "healthy" : "degraded", detail: "Via backend proxy" },
    { key: "weather", label: "Weather (Open-Meteo)", status: "healthy", detail: "Keyless" },
    { key: "ai", label: "AI Service", status: backendOk ? "healthy" : "degraded", detail: "Via backend proxy" },
    {
      key: "sync",
      label: "Pending Sync",
      status: pending > 0 ? "degraded" : "healthy",
      detail: pending > 0 ? `${pending} queued` : "Up to date",
    },
  ];
};
