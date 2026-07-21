import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(5000),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  FRONTEND_URL: z
    .string()
    .default("http://localhost:5173"),

  TOMTOM_API_KEY: z
    .string()
    .min(10, "TOMTOM_API_KEY is required"),

  SUPABASE_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal("")),

  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .optional()
    .or(z.literal("")),

  OPENAI_API_KEY: z
    .string()
    .optional()
    .or(z.literal("")),

  OPENAI_MODEL: z
    .string()
    .optional()
    .or(z.literal("")),
});

export const env = schema.parse(process.env);

export const databaseConfigured = Boolean(
  env.SUPABASE_URL &&
    env.SUPABASE_SERVICE_ROLE_KEY,
);

export const aiConfigured = Boolean(env.OPENAI_API_KEY);