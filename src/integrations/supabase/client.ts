import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export const SUPABASE_CONFIGURED = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://supabase-disabled.invalid";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "supabase-disabled-placeholder";

if (!SUPABASE_CONFIGURED && import.meta.env.DEV) {
  console.warn("[Gruzli] Supabase credentials are absent. Legacy Supabase calls are disabled during the Amvera migration.");
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: SUPABASE_CONFIGURED,
    autoRefreshToken: SUPABASE_CONFIGURED,
    detectSessionInUrl: SUPABASE_CONFIGURED,
  },
  realtime: { params: { eventsPerSecond: 0 } },
});
