import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Supabase demo mode", () => {
  it("does not enable demo mode in Production even when the flag is true", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_GRUZLI_DEMO_MODE", "true");
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");

    const { DEMO_ENABLED } = await import("./client");

    expect(DEMO_ENABLED).toBe(false);
  });
});
