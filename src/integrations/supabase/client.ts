import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import demoSupabase from "./demoClient";

const DEMO_ENABLED = import.meta.env.DEV && import.meta.env.VITE_GRUZLI_DEMO_MODE === "true";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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
