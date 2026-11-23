import { supabase } from "./demoClient";

/**
 * Gruzli currently runs on its local browser database adapter.
 * No remote Supabase client, credentials, or network connection is required.
 */
export { supabase };
export default supabase;
