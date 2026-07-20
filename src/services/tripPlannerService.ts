import type { GeneratedTripPlan } from "../types/tripPlanner";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export const generateTripPlan = async (input: {
  destination: string;
  days: number;
  budget: number;
  currency: string;
  tripType: string;
  transport: string;
}): Promise<GeneratedTripPlan> => {
  const response = await fetch(`${API_URL}/trip-planner/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-demo-user-id": "demo-user",
      "x-demo-user-email": "mariam@example.com",
      "x-demo-user-role": "user",
    },
    body: JSON.stringify(input),
  });

  const result = (await response.json()) as ApiResponse<GeneratedTripPlan>;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.message || "Unable to generate trip plan.");
  }

  return result.data;
};
