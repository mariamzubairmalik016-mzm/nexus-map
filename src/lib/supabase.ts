// Ensure TypeScript knows about Vite's process.env keys
declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_ANON_KEY?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

// Mocking supabase client until we finish migrating to Neon backend
export const supabase = null;
export const isSupabaseConfigured = false;
