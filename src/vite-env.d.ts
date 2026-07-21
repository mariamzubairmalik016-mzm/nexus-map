/// <reference types="vite/client" />

// Custom environment variables exposed to the frontend via Vite.
// See .env.template for descriptions and usage.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
