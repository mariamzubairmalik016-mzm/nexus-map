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

import { ALERT_TYPES, type AlertSeverity, type RoadAlertType } from "../types/roadAlerts";

export { ALERT_TYPES };

/** Mirrors `AlertSeverity` in `src/types/roadAlerts.ts`. */
export const ALERT_SEVERITIES = ["low", "medium", "high", "critical"] as const;

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

/**
 * What "the nearest X" can mean, mapped to Geoapify's category strings.
 *
 * These are a real category search, not a place-name lookup. Geocoding the
 * words "petrol pump" finds somewhere *called* that — it once answered with
 * Cantonment Railway Station — whereas this returns actual fuel stations
 * ordered by distance. Every string below was checked against the live API;
 * `service.fuel` looks right and is rejected, the working name is
 * `service.vehicle.fuel`.
 */
export const NEARBY_CATEGORIES = {
  fuel: "service.vehicle.fuel",
  charging_station: "service.vehicle.charging_station",
  hospital: "healthcare.hospital",
  pharmacy: "healthcare.pharmacy",
  police: "service.police",
  atm: "service.financial.atm",
  bank: "service.financial.bank",
  restaurant: "catering.restaurant",
  cafe: "catering.cafe",
  hotel: "accommodation.hotel",
  supermarket: "commercial.supermarket",
  market: "commercial.marketplace",
  parking: "parking",
  mosque: "religion.place_of_worship.islam",
  airport: "airport",
  bus_station: "public_transport.bus",
} as const;

export type NearbyCategory = keyof typeof NEARBY_CATEGORIES;

/** Mirrors `TRAVEL_MOODS` / `TOURISM_CATEGORIES` in `src/types/tourism.ts`. */
export const TRAVEL_MOODS = [
  "relax", "adventure", "romantic", "family", "food", "photography",
  "history", "beach", "snow", "nature", "luxury", "budget",
] as const;

export const TOURISM_CATEGORIES = [
  "hotel", "resort", "restaurant", "cafe", "museum", "historical", "unesco",
  "beach", "park", "waterfall", "lake", "forest", "mountain", "camping",
  "hiking", "shopping_mall", "market", "fuel_station", "mosque", "hospital",
  "police", "atm", "bus_station", "railway", "airport", "charging_station",
  "rest_area",
] as const;

/** Case-insensitive match against an allow-list, or undefined if there is none. */
export const matchOption = <T extends string>(
  value: unknown,
  options: readonly T[],
): T | undefined => {
  if (typeof value !== "string") return undefined;
  const wanted = value.trim().toLowerCase();
  return options.find((option) => option.toLowerCase() === wanted);
};

/** As `matchOption`, but for fields that must always carry a value. */
export const snapToOption = <T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
): T => matchOption(value, options) ?? fallback;

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
  | { type: "NEARBY"; category: NearbyCategory }
  | {
      type: "FIND_TOURISM";
      /** A city or place name. Optional when a mood or category is given. */
      query?: string;
      mood?: (typeof TRAVEL_MOODS)[number];
      category?: (typeof TOURISM_CATEGORIES)[number];
    }
  | { type: "SCROLL"; direction: "up" | "down" | "top" | "bottom" }
  | { type: "CLICK"; label: string }
  | { type: "BACK" }
  /**
   * Publishes a hazard at the user's current position for everyone else to
   * see. Confirmed before it is sent — see `NEEDS_CONFIRMATION`.
   */
  | {
      type: "REPORT_ALERT";
      alertType: RoadAlertType;
      severity: AlertSeverity;
      description: string;
    }
  /** Raises an emergency alert at the user's current position. Also confirmed. */
  | { type: "SOS"; message?: string };

/**
 * Actions that change something other people see, or that summon help.
 *
 * These are never fired the first time they are decided. Speech recognition
 * mishears, and the cost of a mistake here is not a wrong page — it is a false
 * accident report shown to every other driver, or an emergency alert nobody
 * meant to raise. The assistant states what it is about to do and waits to be
 * told to go ahead; `LiveAIVoice` enforces that regardless of what the model
 * decides, by refusing to submit an action it did not offer on the turn before.
 */
export const NEEDS_CONFIRMATION = ["REPORT_ALERT", "SOS"] as const;

export const needsConfirmation = (action: VoiceAction | null | undefined): boolean =>
  !!action && (NEEDS_CONFIRMATION as readonly string[]).includes(action.type);

/** True when two actions are the same request, so a confirmation can be matched to its offer. */
export const sameAction = (a: VoiceAction | null, b: VoiceAction | null): boolean => {
  if (!a || !b || a.type !== b.type) return false;
  if (a.type === "REPORT_ALERT" && b.type === "REPORT_ALERT") return a.alertType === b.alertType;
  return true;
};

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
5. NEARBY    — the closest one of something. { "type": "NEARBY", "category": "fuel" }
                                        "category" MUST be one of: ${Object.keys(NEARBY_CATEGORIES).join(", ")}.
                                        Map what the user said onto one of those — "petrol pump",
                                        "gas station" and "CNG" are all "fuel". If nothing fits,
                                        use SEARCH instead.
6. FIND_TOURISM — tourist places, attractions, hotels, things to do.
                                        { "type": "FIND_TOURISM", "query": "Skardu", "mood": "adventure", "category": "hotel" }
                                        All three are optional, but give at least one.
                                        "mood" is one of: ${TRAVEL_MOODS.join(", ")}.
                                        "category" is one of: ${TOURISM_CATEGORIES.join(", ")}.
7. SCROLL    — move the page.          { "type": "SCROLL", "direction": "down" }
8. CLICK     — press a visible button. { "type": "CLICK", "label": "Start Navigation" }
9. BACK      — previous page.          { "type": "BACK" }
10. REPORT_ALERT — warn other drivers about a hazard where the user is standing.
                                        { "type": "REPORT_ALERT", "alertType": "accident", "severity": "high", "description": "Two cars blocking the left lane" }
                                        "alertType" is one of: ${ALERT_TYPES.join(", ")}.
                                        "severity" is one of: ${ALERT_SEVERITIES.join(", ")}.
                                        Write the description from what the user said; keep it factual.
11. SOS      — raise an emergency alert. { "type": "SOS", "message": "Car broke down, I'm alone" }
12. NONE     — answer or ask a question, change nothing. { "type": "NONE" }
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
