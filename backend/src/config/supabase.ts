import { createClient } from "@supabase/supabase-js";
import {
  databaseConfigured,
  env,
} from "./env.js";

export const supabaseAdmin = databaseConfigured
  ? createClient(
      env.SUPABASE_URL as string,
      env.SUPABASE_SERVICE_ROLE_KEY as string,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    )
  : null;
