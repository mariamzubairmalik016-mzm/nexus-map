const API_URL =
  // import.meta.env may be untyped in this TS config; cast to any to access VITE_API_URL
  ((import.meta as any).env && (import.meta as any).env.VITE_API_URL) ||
  "http://localhost:5000/api";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

const request = async <T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",

      // Demo auth headers until Supabase is connected
      "x-demo-user-id": "demo-user",
      "x-demo-user-email": "mariam@example.com",
      "x-demo-user-role": "user",

      ...options.headers,
    },
  });

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