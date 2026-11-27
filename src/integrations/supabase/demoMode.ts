export interface DemoModeEnvironment {
  isDevelopment: boolean;
  vercelEnvironment?: string;
  setting?: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
}

/**
 * Demo data is allowed only in local development and Vercel Preview.
 * Production always uses Supabase, even if the demo flag is accidentally set.
 */
export function resolveDemoMode(environment: DemoModeEnvironment): boolean {
  const demoEnvironmentAllowed =
    environment.isDevelopment || environment.vercelEnvironment === "preview";

  if (!demoEnvironmentAllowed) return false;
  if (environment.setting === "true") return true;

  return (
    environment.isDevelopment &&
    environment.setting !== "false" &&
    (!environment.supabaseUrl || !environment.supabasePublishableKey)
  );
}
