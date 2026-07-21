import { createClient } from "@supabase/supabase-js";
import {
  databaseConfigured,
  env,
} from "./env.js";

// Backend-only Supabase admin client (service-role). Never import this into
// browser code. Session features are disabled — this is a stateless server key.
export const supabaseAdmin = databaseConfigured
  ? createClient(
      env.SUPABASE_URL as string,
      env.SUPABASE_SERVICE_ROLE_KEY as string,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    )
  : null;

if (!supabaseAdmin) {
  // Clear, secret-free warning so misconfiguration is obvious in logs.
  console.warn(
    "[nexus] Supabase admin disabled — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env.",
  );
}
