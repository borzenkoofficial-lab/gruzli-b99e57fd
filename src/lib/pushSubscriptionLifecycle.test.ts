import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  removeCurrentPushSubscription,
  savePushSubscriptionForUser,
} from "./pushSubscriptionLifecycle";

const pushMocks = vi.hoisted(() => {
  const upsert = vi.fn();
  const secondEq = vi.fn();
  const firstEq = vi.fn(() => ({ eq: secondEq }));
  const deleteQuery = vi.fn(() => ({ eq: firstEq }));
  const from = vi.fn(() => ({ upsert, delete: deleteQuery }));
  return { upsert, secondEq, firstEq, deleteQuery, from };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: pushMocks.from },
}));

const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");

function makeSubscription() {
  return {
    endpoint: "https://push.example.test/endpoint-1",
    toJSON: () => ({
      endpoint: "https://push.example.test/endpoint-1",
      keys: { p256dh: "public-key", auth: "auth-key" },
    }),
    getKey: vi.fn(() => null),
    unsubscribe: vi.fn().mockResolvedValue(true),
  } as unknown as PushSubscription;
}

function mockServiceWorker(subscription: PushSubscription | null) {
  const getSubscription = vi.fn().mockResolvedValue(subscription);
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistration: vi.fn().mockResolvedValue({
        pushManager: { getSubscription },
      }),
    },
  });
  return { getSubscription };
}

describe("push subscription lifecycle", () => {
  beforeEach(() => {
    pushMocks.from.mockClear();
    pushMocks.upsert.mockReset().mockResolvedValue({ error: null });
    pushMocks.firstEq.mockClear();
    pushMocks.secondEq.mockReset().mockResolvedValue({ error: null });
    pushMocks.deleteQuery.mockClear();
  });

  afterEach(() => {
    if (originalServiceWorker) {
      Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
    } else {
      Reflect.deleteProperty(navigator, "serviceWorker");
    }
    vi.restoreAllMocks();
  });

  it("saves the current browser endpoint under the active user", async () => {
    const subscription = makeSubscription();

    await expect(savePushSubscriptionForUser("user-2", subscription)).resolves.toBe(true);

    expect(pushMocks.from).toHaveBeenCalledWith("push_subscriptions");
    expect(pushMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-2",
        endpoint: "https://push.example.test/endpoint-1",
        p256dh: "public-key",
        auth: "auth-key",
      }),
      { onConflict: "endpoint" },
    );
  });

  it("does not write an incomplete browser subscription", async () => {
    const subscription = {
      endpoint: "https://push.example.test/endpoint-2",
      toJSON: () => ({ endpoint: "https://push.example.test/endpoint-2", keys: {} }),
      getKey: vi.fn(() => null),
    } as unknown as PushSubscription;

    await expect(savePushSubscriptionForUser("user-2", subscription)).resolves.toBe(false);
    expect(pushMocks.from).not.toHaveBeenCalled();
  });

  it("removes only this user's current endpoint and unsubscribes the browser", async () => {
    const subscription = makeSubscription();
    mockServiceWorker(subscription);

    await removeCurrentPushSubscription("user-1");

    expect(pushMocks.from).toHaveBeenCalledWith("push_subscriptions");
    expect(pushMocks.deleteQuery).toHaveBeenCalledTimes(1);
    expect(pushMocks.firstEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(pushMocks.secondEq).toHaveBeenCalledWith("endpoint", subscription.endpoint);
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("still unsubscribes locally if server cleanup fails", async () => {
    const subscription = makeSubscription();
    mockServiceWorker(subscription);
    pushMocks.secondEq.mockRejectedValueOnce(new Error("offline"));

    await expect(removeCurrentPushSubscription("user-1")).resolves.toBeUndefined();
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("does not touch a device subscription when no user is supplied", async () => {
    const subscription = makeSubscription();
    mockServiceWorker(subscription);

    await removeCurrentPushSubscription(null);

    expect(pushMocks.from).not.toHaveBeenCalled();
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
  });
});
