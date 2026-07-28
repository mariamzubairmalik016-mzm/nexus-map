export type TripActivity = {
  time: string;
  title: string;
  description: string;
  category:
    | "arrival"
    | "sightseeing"
    | "food"
    | "nature"
    | "shopping"
    | "rest"
    | "travel"
    | "departure";
  estimatedCost: number;
};

export type TripDay = {
  day: number;
  title: string;
  summary: string;
  activities: TripActivity[];
  estimatedDailyCost: number;
};

export type GeneratedTripPlan = {
  id: string;
  destination: string;
  days: number;
  budget: number;
  currency: string;
  tripType: string;
  transport: string;
  hotelSuggestion: string;
  foodSuggestion: string;
  packingList: string[];
  safetyTips: string[];
  itinerary: TripDay[];
  estimatedTotalCost: number;
  createdAt: string;
  /**
   * Provenance of the stops in this plan:
   *   curated — hand-written guide for this destination
   *   live    — real POIs from live place search
   *   mixed   — both
   *   generic — no place data available; structural template only
   */
  placeSource?: "curated" | "live" | "mixed" | "generic";
  /**
   * Who wrote the day titles and summaries:
   *   model     — rewritten by the language model
   *   generated — the deterministic template (no key, no quota, or model failed)
   * Stops, times and costs are always deterministic regardless.
   */
  narrativeSource?: "model" | "generated";
};
