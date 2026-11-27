import { describe, expect, it } from "vitest";
import { resolveDemoMode } from "./demoMode";

describe("resolveDemoMode", () => {
  it("defaults to demo mode in local development when Supabase credentials are missing", () => {
    expect(resolveDemoMode({
      dev: true,
      setting: undefined,
      supabaseUrl: undefined,
      supabasePublishableKey: undefined,
    })).toBe(true);
  });

  it("allows local development to explicitly require Supabase", () => {
    expect(resolveDemoMode({
      dev: true,
      setting: "false",
      supabaseUrl: undefined,
      supabasePublishableKey: undefined,
    })).toBe(false);
  });

  it("allows local development to force demo mode when credentials exist", () => {
    expect(resolveDemoMode({
      dev: true,
      setting: "true",
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "publishable-test-key",
    })).toBe(true);
  });

  it("allows an explicitly enabled demo mode in Vercel Preview", () => {
    expect(resolveDemoMode({
      dev: false,
      vercelEnv: "preview",
      setting: "true",
    })).toBe(true);
  });

  it("does not enable demo mode in Vercel Preview without explicit opt-in", () => {
    expect(resolveDemoMode({
      dev: false,
      vercelEnv: "preview",
      setting: undefined,
    })).toBe(false);
  });

  it("never enables demo mode in Production, even when explicitly requested", () => {
    expect(resolveDemoMode({
      dev: false,
      vercelEnv: "production",
      setting: "true",
    })).toBe(false);
  });

  it("does not enable demo mode in a production build outside Vercel", () => {
    expect(resolveDemoMode({
      dev: false,
      vercelEnv: undefined,
      setting: "true",
    })).toBe(false);
  });
});
