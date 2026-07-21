import { supabase } from "../lib/supabase";
import { queueRequest } from "./offlineQueue";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

// Forward the real Supabase session token when signed in (the backend validates
// it when Supabase is configured); fall back to demo headers otherwise so the
// app still works against a backend running in demo mode.
const authHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        return headers;
      }
    } catch {
      // fall through to demo headers
    }
  }
  headers["x-demo-user-id"] = "demo-user";
  headers["x-demo-user-email"] = "mariam@example.com";
  headers["x-demo-user-role"] = "user";
  return headers;
};

const request = async <T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> => {
  const url = `${API_URL}${endpoint}`;
  const headers = { ...(await authHeaders()), ...(options.headers as Record<string, string>) };
  const method = (options.method || "GET").toUpperCase();

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (networkError) {
    // Offline / server unreachable: queue writes for background sync so the
    // action is not lost, and surface a friendly message.
    if (method !== "GET") {
      await queueRequest({
        url,
        method,
        headers,
        body: options.body ? JSON.parse(options.body as string) : undefined,
        label: endpoint,
      });
      throw new Error("You are offline — this action was queued and will sync automatically.");
    }
    throw networkError;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const result = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !result.success) {
    throw new Error(result.message || "API request failed.");
  }

  return result.data as T;
};

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),

  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: (endpoint: string) =>
    request<void>(endpoint, {
      method: "DELETE",
    }),
};
