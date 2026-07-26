import { api } from "./api";
import type { GeneratedTripPlan } from "../types/tripPlanner";

// Routed through the shared API layer so the real Supabase session token is
// forwarded. The backend uses AI when configured and falls back to a
// deterministic planner otherwise — either way a full plan is returned.
export const generateTripPlan = (input: {
  destination: string;
  days: number;
  budget: number;
  currency: string;
  tripType: string;
  transport: string;
}): Promise<GeneratedTripPlan> =>
  api.post<GeneratedTripPlan>("/trip-planner/generate", input);
