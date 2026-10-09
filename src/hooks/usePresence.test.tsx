import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePresence } from "./usePresence";

const presenceMocks = vi.hoisted(() => {
  const eq = vi.fn(async (_column: string, _value: string) => ({ error: null }));
  const update = vi.fn((_values: Record<string, string>) => ({ eq }));
  const from = vi.fn((_table: string) => ({ update }));
  return { eq, update, from };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "test-user" } }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: presenceMocks.from },
}));

const originalVisibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
const originalOnline = Object.getOwnPropertyDescriptor(navigator, "onLine");

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value,
  });
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
}

function PresenceProbe() {
  usePresence();
  return null;
}

describe("usePresence lifecycle", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    setVisibility("visible");
    setOnline(true);
    presenceMocks.eq.mockClear();
    presenceMocks.eq.mockImplementation(async () => ({ error: null }));
    presenceMocks.update.mockClear();
    presenceMocks.from.mockClear();
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    root = null;
    container?.remove();
    container = null;

    if (originalVisibility) {
      Object.defineProperty(document, "visibilityState", originalVisibility);
    }
    if (originalOnline) {
      Object.defineProperty(navigator, "onLine", originalOnline);
    }

    vi.useRealTimers();
  });

  async function mountPresence() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<PresenceProbe />);
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("writes presence when the app is visible and online", async () => {
    await mountPresence();

    expect(presenceMocks.from).toHaveBeenCalledWith("profiles");
    expect(presenceMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_seen_at: expect.any(String) }),
    );
    expect(presenceMocks.eq).toHaveBeenCalledWith("user_id", "test-user");
  });

  it("stops the heartbeat while the app is hidden", async () => {
    await mountPresence();
    expect(presenceMocks.eq).toHaveBeenCalledTimes(1);

    act(() => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await act(async () => {
      vi.advanceTimersByTime(120_000);
      await Promise.resolve();
    });

    expect(presenceMocks.eq).toHaveBeenCalledTimes(1);
  });

  it("resumes presence after returning to the foreground", async () => {
    await mountPresence();

    act(() => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await act(async () => {
      vi.advanceTimersByTime(16_000);
      await Promise.resolve();
    });

    await act(async () => {
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(presenceMocks.eq).toHaveBeenCalledTimes(2);
  });

  it("stops the heartbeat while the browser is offline", async () => {
    await mountPresence();

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });

    await act(async () => {
      vi.advanceTimersByTime(120_000);
      await Promise.resolve();
    });

    expect(presenceMocks.eq).toHaveBeenCalledTimes(1);
  });
});
