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
};
