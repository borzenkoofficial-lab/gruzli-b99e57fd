export async function startNotificationListener(pool, onNotification) {
  if (!pool || typeof onNotification !== "function") return async () => {};

  const listener = await pool.connect();
  let stopped = false;
  const handleNotification = async (message) => {
    if (message.channel !== "gruzli_notification_created" || stopped) return;
    let payload;
    try {
      payload = JSON.parse(message.payload || "{}");
    } catch {
      return;
    }
    if (!payload.recipientId || !payload.notificationId) return;

    try {
      const [notificationResult, countResult] = await Promise.all([
        pool.query(
          "SELECT id, type, title, body, entity_type, entity_id, metadata, read_at, created_at " +
          "FROM notifications WHERE id = $1 AND recipient_id = $2 LIMIT 1",
          [payload.notificationId, payload.recipientId],
        ),
        pool.query(
          "SELECT count(*)::int AS unread_count FROM notifications WHERE recipient_id = $1 AND read_at IS NULL",
          [payload.recipientId],
        ),
      ]);
      if (!notificationResult.rowCount || stopped) return;
      onNotification({
        recipientId: payload.recipientId,
        notification: notificationResult.rows[0],
        unreadCount: countResult.rows[0]?.unread_count || 0,
      });
    } catch (error) {
      console.error("[notifications] Realtime delivery failed:", error.message);
    }
  };

  listener.on("notification", handleNotification);
  listener.on("error", (error) => {
    if (!stopped) console.error("[notifications] PostgreSQL listener error:", error.message);
  });
  try {
    await listener.query("LISTEN gruzli_notification_created");
  } catch (error) {
    listener.removeListener("notification", handleNotification);
    listener.release();
    throw error;
  }

  return async () => {
    if (stopped) return;
    stopped = true;
    listener.removeListener("notification", handleNotification);
    try {
      await listener.query("UNLISTEN gruzli_notification_created");
    } catch {}
    listener.release();
  };
}
