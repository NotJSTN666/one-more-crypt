/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** "true" once Sign in with X is configured in Supabase. */
  readonly VITE_AUTH_X?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
