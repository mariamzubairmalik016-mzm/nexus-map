import type { RequestHandler } from "express";
import { supabaseAdmin } from "../config/supabase.js";
import { HttpError } from "../utils/httpError.js";

export const requireAuth: RequestHandler = async (request, _response, next) => {
  const header = request.headers.authorization;

  if (supabaseAdmin) {
    if (!header?.startsWith("Bearer ")) {
      next(new HttpError(401, "Authentication token is required."));
      return;
    }

    const token = header.slice(7);
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      next(new HttpError(401, "Invalid or expired authentication token."));
      return;
    }

    request.authUser = {
      id: data.user.id,
      email: data.user.email,
      role: String(data.user.user_metadata?.role ?? "user"),
    };
    next();
    return;
  }

  request.authUser = {
    id: String(request.headers["x-demo-user-id"] ?? "demo-user"),
    email: String(request.headers["x-demo-user-email"] ?? "mariam@example.com"),
    role: String(request.headers["x-demo-user-role"] ?? "user"),
  };
  next();
};

export const requireAdmin: RequestHandler = (request, _response, next) => {
  if (request.authUser?.role !== "admin") {
    next(new HttpError(403, "Administrator access is required."));
    return;
  }

  next();
};
