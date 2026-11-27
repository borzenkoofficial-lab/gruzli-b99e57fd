import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveDemoMode } from "./demoMode";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("resolveDemoMode", () => {
  it("defaults to demo mode in local development when Supabase credentials are missing", () => {
    expect(resolveDemoMode({
      isDevelopment: true,
      setting: undefined,
    })).toBe(true);
  });

  it("allows local development to explicitly require Supabase", () => {
    expect(resolveDemoMode({
      isDevelopment: true,
      setting: "false",
    })).toBe(false);
  });

  it("allows local development to force demo mode when credentials exist", () => {
    expect(resolveDemoMode({
      isDevelopment: true,
      setting: "true",
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "publishable-test-key",
    })).toBe(true);
  });

  it("allows explicitly enabled demo mode in Vercel Preview", () => {
    expect(resolveDemoMode({
      isDevelopment: false,
      vercelEnvironment: "preview",
      setting: "true",
    })).toBe(true);
  });

  it("does not enable demo mode in Vercel Preview without explicit opt-in", () => {
    expect(resolveDemoMode({
      isDevelopment: false,
      vercelEnvironment: "preview",
      setting: undefined,
    })).toBe(false);
  });

  it("never enables demo mode in Production, even when explicitly requested", () => {
    expect(resolveDemoMode({
      isDevelopment: false,
      vercelEnvironment: "production",
      setting: "true",
    })).toBe(false);
  });

  it("does not enable demo mode in production builds outside Vercel", () => {
    expect(resolveDemoMode({
      isDevelopment: false,
      vercelEnvironment: undefined,
      setting: "true",
    })).toBe(false);
  });
});

describe("Supabase demo mode integration", () => {
  it("does not enable demo mode in Production even when the flag is true", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VITE_GRUZLI_DEMO_MODE", "true");
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");

    const { DEMO_ENABLED } = await import("./client");

    expect(DEMO_ENABLED).toBe(false);
  });
});
