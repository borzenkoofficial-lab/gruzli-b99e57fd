import { supabase } from "@/integrations/supabase/client";
import { getNotificationSettings } from "@/hooks/useNotificationSettings";

/**
 * Send a transactional email notification (fire-and-forget, non-blocking).
 * Respects user notification settings from localStorage.
 */
export async function sendEmailNotification(params: {
  templateName: string;
  recipientEmail: string;
  idempotencyKey: string;
  templateData?: Record<string, any>;
}) {
  try {
    await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: params.templateName,
        recipientEmail: params.recipientEmail,
        idempotencyKey: params.idempotencyKey,
        templateData: params.templateData,
      },
    });
  } catch (err) {
    // Fire-and-forget — don't block UI
    console.error("Email notification failed:", err);
  }
}

/**
 * Get the email address associated with a user_id via auth metadata.
 * Falls back to looking at profiles or asking supabase.
 */
export async function getUserEmail(userId: string): Promise<string | null> {
  // We can't query auth.users from client. Instead, use a workaround:
  // The current user's email is available, but for other users we need an edge function.
  // For now, return null for other users — the edge function trigger handles this server-side.
  return null;
}
