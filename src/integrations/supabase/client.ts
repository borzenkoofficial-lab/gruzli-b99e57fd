import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import demoSupabase from "./demoClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const DEMO_MODE_SETTING = import.meta.env.VITE_GRUZLI_DEMO_MODE;

// Local development uses the isolated browser-backed demo database by default
// when Supabase credentials are not configured. Set VITE_GRUZLI_DEMO_MODE=false
// to require Supabase locally, or true to force demo mode.
export const DEMO_ENABLED = import.meta.env.DEV && (
  DEMO_MODE_SETTING === "true" ||
  (DEMO_MODE_SETTING !== "false" && (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY))
);

if (!DEMO_ENABLED && (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY)) {
  throw new Error("Gruzli: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required in production.");
}

export const supabase = DEMO_ENABLED
  ? demoSupabase
  : createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
