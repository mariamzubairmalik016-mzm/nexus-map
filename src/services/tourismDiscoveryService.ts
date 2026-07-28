import type {
  TourismPOI,
  TourismCategory,
  TravelMood,
  BudgetAnalysis,
  BudgetBreakdown,
  CarbonEstimate,
  RiskScore,
  RouteComparison,
  PlaceHistory,
} from "../types/tourism";
import { MOOD_RECOMMENDATIONS } from "../types/tourism";
import { api } from "./api";
import { offlineDb } from "./offlineDb";

// ─── Service ───────────────────────────────────────────────
export const tourismDiscoveryService = {
  /** Search POIs by query, category, city, or mood */
  async searchPOI(params: {
    query?: string;
    category?: TourismCategory;
    city?: string;
    mood?: TravelMood;
    limit?: number;
  }): Promise<TourismPOI[]> {
    // Build query params for the API
    const qp = new URLSearchParams();
    if (params.query) qp.set("query", params.query);
    if (params.category) qp.set("category", params.category);
    if (params.city) qp.set("city", params.city);
    if (params.limit) qp.set("limit", String(params.limit));

    try {
      const data = await api.get<TourismPOI[]>(`/tourism/pois?${qp.toString()}`);

      // Apply mood filter client-side after getting results
      let filtered = data;
      if (params.mood) {
        const moodConfig = MOOD_RECOMMENDATIONS[params.mood];
        if (moodConfig) {
          filtered = filtered.filter((p) =>
            moodConfig.categories.includes(p.category as TourismCategory)
          );
        }
      }

      // Cache for offline
      if (filtered.length > 0) {
        // `{ id: p.id, ...p }` set `id` twice and the spread overwrote it, so
        // the explicit key did nothing. `p` already carries its own id.
        void offlineDb.saveDestinations(filtered.map((p) => ({ ...p }))).catch(() => {});
      }

      return filtered;
    } catch {
      // Offline or API unavailable: fall back to cached data
      const cached = await offlineDb.getDestinations<TourismPOI>().catch(() => []);

      let results = cached;
      if (params.category) {
        results = results.filter((p) => p.category === params.category);
      }

      if (params.mood) {
        const moodConfig = MOOD_RECOMMENDATIONS[params.mood];
        if (moodConfig) {
          results = results.filter((p) =>
            moodConfig.categories.includes(p.category)
          );
        }
      }

      if (params.city) {
        const cityLower = params.city.toLowerCase();
        results = results.filter(
          (p) =>
            p.city.toLowerCase().includes(cityLower) ||
            p.country.toLowerCase().includes(cityLower)
        );
      }

      const q = params.query?.toLowerCase().trim();
      if (q) {
        results = results.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.tags.some((t) => t.toLowerCase().includes(q))
        );
      }

      results.sort((a, b) => b.rating - a.rating);
      return results.slice(0, params.limit ?? 50);
    }
  },

  /** Get mood-based recommendations */
  async getMoodRecommendations(mood: TravelMood): Promise<TourismPOI[]> {
    return this.searchPOI({ mood, limit: 20 });
  },

  /** Get city discovery data */
  async getCityDiscovery(city: string): Promise<any> {
    try {
      return await api.get<any>(`/tourism/discover?city=${encodeURIComponent(city)}`);
    } catch {
      // Offline fallback
      const pois = await this.searchPOI({ city, limit: 100 });
      if (pois.length === 0) return null;
      return {
        city,
        country: pois[0].country,
        famousPlaces: pois.filter((p) => p.isFeatured),
        localFood: ["Local specialties"],
        shoppingStreets: [],
        weekendActivities: [],
      };
    }
  },

  /** Get local food suggestions */
  async getLocalFood(city: string): Promise<string[]> {
    try {
      const data = await api.get<any>(`/tourism/discover?city=${encodeURIComponent(city)}`);
      return data.localFood || ["Local cuisine"];
    } catch {
      return ["Local cuisine"];
    }
  },

  /** Get history for a place — would use knowledge-base API in production */
  async getPlaceHistory(placeName: string): Promise<PlaceHistory | null> {
    return null;
  },

  /** Calculate budget analysis (pure calculation, no API call needed) */
  calculateBudget(
    totalBudget: number,
    days: number,
    travelers: number,
    destination: string,
    currency: string
  ): BudgetAnalysis {
    const breakdown: BudgetBreakdown[] = [
      {
        category: "hotel", label: "Accommodation",
        estimatedCost: Math.round(totalBudget * 0.35),
        percentage: 35,
        tips: ["Book in advance for better rates", "Consider guesthouses for budget savings"],
      },
      {
        category: "food", label: "Food & Dining",
        estimatedCost: Math.round(totalBudget * 0.2),
        percentage: 20,
        tips: ["Try local street food for authentic flavors", "Look for daily lunch specials"],
      },
      {
        category: "fuel", label: "Transportation",
        estimatedCost: Math.round(totalBudget * 0.15),
        percentage: 15,
        tips: ["Use public transport to save", "Carpool with other travelers"],
      },
      {
        category: "activities", label: "Activities & Tickets",
        estimatedCost: Math.round(totalBudget * 0.12),
        percentage: 12,
        tips: ["Look for combo tickets", "Visit free attractions"],
      },
      {
        category: "shopping", label: "Shopping & Souvenirs",
        estimatedCost: Math.round(totalBudget * 0.08),
        percentage: 8,
        tips: ["Bargain at local markets", "Set a spending limit"],
      },
      {
        category: "emergency", label: "Emergency Fund",
        estimatedCost: Math.round(totalBudget * 0.05),
        percentage: 5,
        tips: ["Keep emergency cash separate", "Have travel insurance"],
      },
      {
        category: "miscellaneous", label: "Miscellaneous",
        estimatedCost: Math.round(totalBudget * 0.05),
        percentage: 5,
        tips: ["Carry extra for unexpected expenses"],
      },
    ];

    const totalEstimated = breakdown.reduce((sum, item) => sum + item.estimatedCost, 0);
    const ratio = totalBudget > 0 ? totalEstimated / totalBudget : 1;
    const score = Math.round(Math.max(0, Math.min(100, (1 - Math.abs(ratio - 1)) * 100)));

    let scoreLabel = "Excellent";
    if (score < 80) scoreLabel = "Good";
    if (score < 60) scoreLabel = "Fair";
    if (score < 40) scoreLabel = "Needs Adjustment";

    return {
      totalBudget,
      totalEstimated,
      currency,
      score,
      scoreLabel,
      breakdown,
      savingsSuggestions: [
        "Travel during off-peak season for lower prices",
        "Book accommodations with kitchen facilities",
        "Use city passes for attractions",
        "Eat where locals eat",
      ],
      dailyAverage: Math.round(totalEstimated / days),
      perPersonCost: Math.round(totalEstimated / travelers),
    };
  },

  /** Calculate carbon footprint estimate */
  estimateCarbon(distanceKm: number, transportType: string): CarbonEstimate {
    const emissions: Record<string, number> = {
      car: 0.192, bus: 0.105, train: 0.041, flight: 0.285, motorcycle: 0.103,
    };
    const factor = emissions[transportType.toLowerCase()] || 0.15;
    const totalCO2Kg = Math.round(distanceKm * factor);

    const ecoScore = Math.round(
      transportType === "train" ? 85 :
      transportType === "bus" ? 70 :
      transportType === "motorcycle" ? 60 :
      transportType === "car" ? 40 :
      transportType === "flight" ? 10 : 50
    );

    return {
      totalCO2Kg,
      ecoScore,
      greenRoutes: ["Take the train", "Use public transport", "Consider carpooling"],
      suggestions: [
        "Choose direct routes to minimize distance",
        "Offset your carbon through verified programs",
        "Pack light to reduce vehicle weight",
      ],
    };
  },

  /** Calculate risk score for a destination */
  calculateRiskScore(params: {
    weather: "clear" | "rain" | "storm" | "extreme";
    traffic: number;
    roadConditions: "good" | "fair" | "poor";
    flood: boolean;
    airQuality: "good" | "moderate" | "poor";
  }): RiskScore {
    const weatherScore =
      params.weather === "clear" ? 90 :
      params.weather === "rain" ? 60 :
      params.weather === "storm" ? 30 : 10;

    const trafficScore = Math.max(0, 100 - params.traffic * 10);
    const roadScore =
      params.roadConditions === "good" ? 90 :
      params.roadConditions === "fair" ? 60 : 30;

    const floodScore = params.flood ? 10 : 90;
    const airScore =
      params.airQuality === "good" ? 90 :
      params.airQuality === "moderate" ? 60 : 20;

    const overall = Math.round(
      (weatherScore * 0.25 + trafficScore * 0.2 + roadScore * 0.2 + floodScore * 0.2 + airScore * 0.15)
    );

    const recommendations: string[] = [];
    if (weatherScore < 40) recommendations.push("Check weather alerts before traveling");
    if (trafficScore < 40) recommendations.push("Avoid peak traffic hours");
    if (roadScore < 40) recommendations.push("Road conditions may be hazardous");
    if (floodScore < 40) recommendations.push("Flood warnings in effect - have alternate routes");
    if (airScore < 40) recommendations.push("Poor air quality - wear masks if needed");

    return {
      overall,
      weather: weatherScore,
      traffic: trafficScore,
      roadConditions: roadScore,
      flood: floodScore,
      airQuality: airScore,
      recommendations,
      safeToTravel: overall >= 50,
    };
  },

  /** Compare routes */
  compareRoutes(distanceKm: number, durationMinutes: number): RouteComparison[] {
    const baseDistance = distanceKm || 100;
    const baseTime = durationMinutes || 120;

    return [
      { type: "fastest", distanceKm: baseDistance, durationMinutes: baseTime, description: "Quickest route with minimal stops", score: 90 },
      { type: "shortest", distanceKm: baseDistance * 0.85, durationMinutes: baseTime * 1.1, description: "Minimum distance traveled", score: 85 },
      { type: "scenic", distanceKm: baseDistance * 1.25, durationMinutes: baseTime * 1.3, description: "Beautiful views and scenic stops", score: 80 },
      { type: "tourist", distanceKm: baseDistance * 1.15, durationMinutes: baseTime * 1.2, description: "Passes major tourist attractions", score: 75 },
      { type: "family_safe", distanceKm: baseDistance * 1.1, durationMinutes: baseTime * 1.15, description: "Safest roads for family travel", score: 88 },
      { type: "eco", distanceKm: baseDistance * 1.05, durationMinutes: baseTime * 1.05, description: "Lowest carbon footprint route", score: 82 },
    ];
  },
};
