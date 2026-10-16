/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** "true" once Sign in with X is configured in Supabase. */
  readonly VITE_AUTH_X?: string;
  /** The public address for share links and sign-in emails, when it differs from where the game runs (itch.io). */
  readonly VITE_PUBLIC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
