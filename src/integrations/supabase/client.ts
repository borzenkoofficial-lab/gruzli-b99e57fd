import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import demoSupabase from "./demoClient";

const DEMO_ENABLED = import.meta.env.DEV && import.meta.env.VITE_GRUZLI_DEMO_MODE === "true";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** True when real Supabase credentials are present. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

/** True when the local offline demo mode is active (DEV + flag). */
export const isDemoMode = DEMO_ENABLED;

let client: SupabaseClient<Database> | typeof demoSupabase;

if (DEMO_ENABLED) {
  client = demoSupabase;
} else if (isSupabaseConfigured) {
  client = createClient<Database>(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
} else {
  // Soft fallback so the app still boots and can show a configuration screen
  // instead of a blank white page when production env vars are missing.
  console.error(
    "[Gruzli] Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. Falling back to offline demo shell.",
  );
  client = demoSupabase;
}

export const supabase = client;
