/**
 * The set of things the Live AI assistant is allowed to do to the app.
 *
 * This file is the single source of truth for that: the system prompt is
 * generated from `PAGES` and `ACTION_GUIDE` below, the server validates
 * against the same list, and the client executes it. Keeping one list means a
 * page added here becomes reachable by voice without touching three files —
 * and the model can never be told about a route that does not exist.
 *
 * Place names are deliberately *not* resolved by the model. It returns names
 * ("Lahore", "Liberty Market"); the server geocodes them through the same
 * TomTom/Geoapify/OSM pipeline the search box uses. An LLM asked for lat/lng
 * will happily invent coordinates that land in a field.
 */

export type PageKey =
  | "home"
  | "map"
  | "planner"
  | "explore"
  | "tourism"
  | "alerts"
  | "community"
  | "hub"
  | "safety"
  | "offline"
  | "favorites"
  | "history"
  | "notifications"
  | "profile"
  | "settings"
  | "dashboard"
  | "admin"
  | "login"
  | "signup";

/** Every page the assistant can open, and what it is for. */
export const PAGES: Record<PageKey, { path: string; purpose: string }> = {
  home: { path: "/", purpose: "Landing page" },
  map: { path: "/map", purpose: "Live map, search, routing, navigation, traffic" },
  planner: { path: "/ai-planner", purpose: "AI trip planner — itinerary, budget, hotels" },
  explore: { path: "/explore", purpose: "Explore destinations and cities" },
  tourism: { path: "/smart-tourism", purpose: "Tourist places, attractions, reviews" },
  alerts: { path: "/road-alerts", purpose: "Community road alerts — accidents, blocks, police" },
  community: { path: "/community", purpose: "Community notes and tips" },
  hub: { path: "/community-hub", purpose: "Travel groups and community hub" },
  safety: { path: "/safety", purpose: "Safety centre, SOS, emergency contacts" },
  offline: { path: "/offline-maps", purpose: "Download map regions for offline use" },
  favorites: { path: "/favorites", purpose: "Saved favourite places" },
  history: { path: "/history", purpose: "Past trips and searches" },
  notifications: { path: "/notifications", purpose: "Notifications" },
  profile: { path: "/profile", purpose: "User profile" },
  settings: { path: "/settings", purpose: "App settings and preferences" },
  dashboard: { path: "/dashboard", purpose: "User dashboard overview" },
  admin: { path: "/admin", purpose: "Admin panel (admins only)" },
  login: { path: "/login", purpose: "Sign in" },
  signup: { path: "/signup", purpose: "Create an account" },
};

/** Mirrors `TravelMode` in `src/types/savedRoute.ts` — the map supports these three. */
export type TravelMode = "car" | "pedestrian" | "bicycle";

/**
 * The planner's dropdowns, mirrored from `src/views/AIPlanner/AIPlanner.tsx`.
 *
 * A `<select>` handed a value that is not one of its options renders blank, so
 * anything the model invents ("Personal", "Rickshaw") has to be snapped back
 * to a real option before it reaches the URL.
 */
export const TRIP_TYPES = ["Family", "Solo", "Couple", "Friends", "Business", "Adventure"] as const;
export const TRANSPORTS = ["Car", "Bus", "Train", "Flight", "Motorcycle"] as const;
export const CURRENCIES = ["PKR", "USD", "SAR", "AED", "GBP", "EUR"] as const;

/** Case-insensitive match against an allow-list, else the fallback. */
export const snapToOption = <T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
): T => {
  if (typeof value !== "string") return fallback;
  const wanted = value.trim().toLowerCase();
  return options.find((option) => option.toLowerCase() === wanted) ?? fallback;
};

/**
 * What the model may return.
 *
 * `ROUTE` and `PLAN_TRIP` carry raw place names — the server rewrites them
 * into a `NAVIGATE` with real coordinates before the client ever sees them.
 * The rest are executed as-is in the browser.
 */
export type VoiceAction =
  | { type: "NONE" }
  | { type: "NAVIGATE"; page?: PageKey; url?: string }
  | {
      type: "ROUTE";
      /** Omit to route from the user's current GPS position. */
      from?: string;
      to: string;
      mode?: TravelMode;
      /** Begin turn-by-turn immediately rather than only drawing the route. */
      start?: boolean;
    }
  | {
      type: "PLAN_TRIP";
      destination: string;
      days?: number;
      budget?: number;
      currency?: string;
      tripType?: string;
      transport?: string;
    }
  | { type: "SEARCH"; query: string }
  | { type: "NEARBY"; category: string }
  | { type: "SCROLL"; direction: "up" | "down" | "top" | "bottom" }
  | { type: "CLICK"; label: string }
  | { type: "BACK" };

/** Written into the system prompt so the model sees exactly these options. */
export const ACTION_GUIDE = `
1. NAVIGATE  — open a page.            { "type": "NAVIGATE", "page": "map" }
2. ROUTE     — draw a route.           { "type": "ROUTE", "from": "Lahore", "to": "Islamabad", "mode": "car", "start": false }
                                        Omit "from" to start from the user's current location.
                                        "mode" is one of: car, pedestrian, bicycle.
                                        Set "start": true when the user says start/begin navigation.
3. PLAN_TRIP — build a trip plan.      { "type": "PLAN_TRIP", "destination": "Hunza", "days": 5, "budget": 80000, "currency": "PKR", "tripType": "Family", "transport": "Car" }
                                        "tripType" is one of: ${TRIP_TYPES.join(", ")}.
                                        "transport" is one of: ${TRANSPORTS.join(", ")}.
                                        "currency" is one of: ${CURRENCIES.join(", ")}.
                                        "days" is 1-14.
4. SEARCH    — find a place on the map.{ "type": "SEARCH", "query": "Liberty Market Lahore" }
5. NEARBY    — nearby of a category.   { "type": "NEARBY", "category": "petrol pump" }
6. SCROLL    — move the page.          { "type": "SCROLL", "direction": "down" }
7. CLICK     — press a visible button. { "type": "CLICK", "label": "Start Navigation" }
8. BACK      — previous page.          { "type": "BACK" }
9. NONE      — just answer, no action. { "type": "NONE" }
`.trim();

/** The page list, formatted for the prompt. */
export const pageDirectory = () =>
  (Object.keys(PAGES) as PageKey[])
    .map((key) => `- ${key} (${PAGES[key].path}) — ${PAGES[key].purpose}`)
    .join("\n");

export const isPageKey = (value: unknown): value is PageKey =>
  typeof value === "string" && value in PAGES;

/**
 * Runs a browser-side action. Server-resolved actions arrive here as
 * `NAVIGATE`, so this only has to cover navigation and direct page control.
 *
 * Returns a short description of what happened, or null when nothing was done
 * — the caller uses that to tell the user a button could not be found rather
 * than silently doing nothing.
 */
export const executeVoiceAction = (
  action: VoiceAction | null | undefined,
  router: { push: (url: string) => void; back: () => void },
): string | null => {
  if (!action || action.type === "NONE") return null;

  switch (action.type) {
    case "NAVIGATE": {
      const url = action.url || (isPageKey(action.page) ? PAGES[action.page].path : null);
      if (!url) return null;
      router.push(url);
      return `Opened ${url}`;
    }

    case "BACK": {
      router.back();
      return "Went back";
    }

    case "SCROLL": {
      if (typeof window === "undefined") return null;
      const step = window.innerHeight * 0.8;
      const target =
        action.direction === "top"
          ? 0
          : action.direction === "bottom"
            ? document.body.scrollHeight
            : window.scrollY + (action.direction === "up" ? -step : step);
      window.scrollTo({ top: target, behavior: "smooth" });
      return `Scrolled ${action.direction}`;
    }

    case "CLICK": {
      if (typeof window === "undefined") return null;
      const wanted = action.label.trim().toLowerCase();
      if (!wanted) return null;

      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(
          'button, a, [role="button"], input[type="submit"]',
        ),
      ).filter((element) => {
        // Skip anything the user could not have clicked either.
        if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") {
          return false;
        }
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      });

      const labelOf = (element: HTMLElement) =>
        (element.getAttribute("aria-label") || element.innerText || element.title || "")
          .trim()
          .toLowerCase();

      // Exact match first, then contains — "Start" should not beat
      // "Start Navigation" when the user asked for the latter.
      const match =
        candidates.find((element) => labelOf(element) === wanted) ??
        candidates.find((element) => labelOf(element).includes(wanted));

      if (!match) return null;
      match.click();
      return `Pressed "${action.label}"`;
    }

    // ROUTE / PLAN_TRIP / SEARCH / NEARBY are resolved into NAVIGATE on the
    // server, where the geocoder lives. Reaching here means the server could
    // not resolve the place, and it has already said so in its spoken reply.
    default:
      return null;
  }
};
