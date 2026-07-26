// Single source of truth for connectivity. Every service/page reads this
// instead of calling navigator.onLine independently.

type Listener = (online: boolean) => void;

const nav = typeof navigator !== "undefined" ? navigator : undefined;
let online = nav ? nav.onLine : true;
let lastOnlineAt = online ? Date.now() : 0;
const listeners = new Set<Listener>();

const setOnline = (value: boolean) => {
  if (value === online) return;
  online = value;
  if (value) lastOnlineAt = Date.now();
  listeners.forEach((listener) => listener(value));
};

if (typeof window !== "undefined") {
  window.addEventListener("online", () => setOnline(true));
  window.addEventListener("offline", () => setOnline(false));
}

export const networkStatus = {
  isOnline: () => online,
  isOffline: () => !online,
  lastOnlineAt: () => lastOnlineAt,
  connectionType: () =>
    (nav as unknown as { connection?: { effectiveType?: string } })?.connection?.effectiveType ?? "unknown",
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** Thrown (and swallowed by callers) when a network call is skipped offline. */
export class OfflineError extends Error {
  constructor() {
    super("You are offline.");
    this.name = "OfflineError";
  }
}

/** Guard placed before any live fetch/WebSocket so it never runs offline. */
export const assertOnline = () => {
  if (!online) throw new OfflineError();
};
