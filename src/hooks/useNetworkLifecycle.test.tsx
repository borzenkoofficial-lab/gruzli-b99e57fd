import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { onlineManager, type QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNetworkLifecycle } from "./useNetworkLifecycle";

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

function LifecycleProbe({ queryClient }: { queryClient: QueryClient }) {
  useNetworkLifecycle(queryClient);
  return null;
}

describe("useNetworkLifecycle", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let queryClient: QueryClient;
  let previousOnline = true;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    previousOnline = onlineManager.isOnline();
    setVisibility("hidden");
    setOnline(true);
    queryClient = {
      refetchQueries: vi.fn().mockResolvedValue(undefined),
    } as unknown as QueryClient;
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
    } else {
      Reflect.deleteProperty(document, "visibilityState");
    }
    if (originalOnline) {
      Object.defineProperty(navigator, "onLine", originalOnline);
    } else {
      Reflect.deleteProperty(navigator, "onLine");
    }

    vi.restoreAllMocks();
    onlineManager.setOnline(previousOnline);
    vi.useRealTimers();
  });

  async function mountLifecycle() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<LifecycleProbe queryClient={queryClient} />);
      await Promise.resolve();
    });
  }

  it("revalidates stale active queries on foreground resume", async () => {
    await mountLifecycle();
    vi.spyOn(onlineManager, "isOnline").mockReturnValue(true);

    act(() => {
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(queryClient.refetchQueries).toHaveBeenCalledTimes(1);
    expect(queryClient.refetchQueries).toHaveBeenCalledWith({
      type: "active",
      stale: true,
    });
  });

  it("does not refetch while hidden or repeatedly within the debounce window", async () => {
    await mountLifecycle();
    vi.spyOn(onlineManager, "isOnline").mockReturnValue(true);

    act(() => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(queryClient.refetchQueries).toHaveBeenCalledTimes(1);
  });

  it("lets React Query own reconnect refetches instead of forcing a duplicate", async () => {
    await mountLifecycle();
    const setOnlineSpy = vi.spyOn(onlineManager, "setOnline");

    act(() => {
      onlineManager.setOnline(false);
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(setOnlineSpy).toHaveBeenCalledWith(true);
    expect(queryClient.refetchQueries).not.toHaveBeenCalled();
  });

  it("does not force another refresh immediately after a reconnect", async () => {
    await mountLifecycle();

    act(() => {
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(queryClient.refetchQueries).not.toHaveBeenCalled();
  });
});
