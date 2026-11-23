import { supabase } from "@/integrations/supabase/client";

function arrayBufferToBase64Url(value: ArrayBuffer | null): string {
  if (!value) return "";
  const bytes = new Uint8Array(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Associates an existing browser subscription with the authenticated account.
 * Call only with the fresh user ID returned by supabase.auth.getUser().
 */
export async function savePushSubscriptionForUser(
  userId: string,
  subscription: PushSubscription,
): Promise<boolean> {
  const json = subscription.toJSON();
  const endpoint = json.endpoint || subscription.endpoint;
  const p256dh = json.keys?.p256dh || arrayBufferToBase64Url(subscription.getKey("p256dh"));
  const auth = json.keys?.auth || arrayBufferToBase64Url(subscription.getKey("auth"));

  if (!userId || !endpoint || !p256dh || !auth) return false;

  try {
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          endpoint,
          p256dh,
          auth,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        },
        { onConflict: "endpoint" },
      );

    if (error) {
      console.warn("[Gruzli Push] Could not sync device subscription:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Gruzli Push] Could not sync device subscription:", error);
    return false;
  }
}

/**
 * Removes this browser's push endpoint before logout so the next account does
 * not keep receiving notifications addressed to the previous account.
 * Logout must remain possible even if the network or browser API fails.
 */
export async function removeCurrentPushSubscription(userId: string | null | undefined): Promise<void> {
  if (!userId || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;

    try {
      const { error } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("endpoint", subscription.endpoint);

      if (error) {
        console.warn("[Gruzli Push] Could not remove device subscription:", error.message);
      }
    } finally {
      // If server cleanup fails (for example while offline), invalidating the
      // endpoint locally still prevents further delivery to this browser.
      try {
        await subscription.unsubscribe();
      } catch {
        // Best effort; never block logout.
      }
    }
  } catch (error) {
    console.warn("[Gruzli Push] Device subscription cleanup failed:", error);
  }
}
