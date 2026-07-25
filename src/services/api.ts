import { supabase } from "../lib/supabase";
import { queueRequest } from "./offlineQueue";
import { networkStatus, OfflineError } from "./networkStatus";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

// NextAuth uses HTTP-only cookies, so we don't need to manually inject auth headers.
// The browser will automatically send the session cookie with every fetch request to /api.
const authHeaders = async (): Promise<Record<string, string>> => {
  return { "Content-Type": "application/json" };
};

const request = async <T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> => {
  const url = `${API_URL}${endpoint}`;
  const headers = { ...(await authHeaders()), ...(options.headers as Record<string, string>) };
  const method = (options.method || "GET").toUpperCase();

  // Offline-first: never touch the network while offline. Writes are queued;
  // reads throw OfflineError so the caller can serve its local cache.
  if (networkStatus.isOffline()) {
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
    throw new OfflineError();
  }

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
