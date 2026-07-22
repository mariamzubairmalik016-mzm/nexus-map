import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/httpError.js";

export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  _next,
) => {
  if (error instanceof ZodError) {
    // Surface the first specific message ("Start and destination are the same
    // place.") so the UI can show it verbatim instead of a generic string.
    const specific = error.issues.find((issue) => issue.message && issue.message !== "Required");
    response.status(400).json({
      success: false,
      message: specific?.message ?? "Validation failed.",
      errors: error.flatten(),
    });
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    success: false,
    message: "Internal server error.",
  });
};
