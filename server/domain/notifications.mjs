const NOTIFICATION_TYPES = new Set(["job", "message", "response", "system"]);

export async function createNotification(db, input) {
  if (!input?.recipientId || !NOTIFICATION_TYPES.has(input.type)) {
    throw new TypeError("Invalid notification recipient or type.");
  }
  const title = String(input.title || "").trim();
  const body = String(input.body || "");
  if (!title || title.length > 180 || body.length > 2000) {
    throw new TypeError("Invalid notification title or body.");
  }
  const metadata = input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
    ? input.metadata
    : {};
  const values = [
    input.recipientId,
    input.actorUserId || null,
    input.type,
    title,
    body,
    input.entityType || null,
    input.entityId == null ? null : String(input.entityId),
    JSON.stringify(metadata),
    input.dedupeKey || null,
  ];
  const inserted = await db.query(
    "INSERT INTO notifications (recipient_id, actor_user_id, type, title, body, entity_type, entity_id, metadata, dedupe_key) " +
    "VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) " +
    "ON CONFLICT (recipient_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING RETURNING *",
    values,
  );
  if (inserted.rowCount) return inserted.rows[0];
  const existing = await db.query(
    "SELECT * FROM notifications WHERE recipient_id = $1 AND dedupe_key = $2 LIMIT 1",
    [input.recipientId, input.dedupeKey],
  );
  return existing.rows[0] || null;
}

export async function listNotifications(db, recipientId, limit = 50, offset = 0) {
  const safeLimit = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 50));
  const safeOffset = Math.max(0, Math.min(10000, Number.parseInt(offset, 10) || 0));
  const result = await db.query(
    "SELECT id, type, title, body, entity_type, entity_id, metadata, read_at, created_at " +
    "FROM notifications WHERE recipient_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3",
    [recipientId, safeLimit, safeOffset],
  );
  return result.rows;
}

export async function getUnreadNotificationCount(db, recipientId) {
  const result = await db.query(
    "SELECT count(*)::int AS unread_count FROM notifications WHERE recipient_id = $1 AND read_at IS NULL",
    [recipientId],
  );
  return result.rows[0]?.unread_count || 0;
}

export async function markNotificationRead(db, recipientId, notificationId) {
  const result = await db.query(
    "UPDATE notifications SET read_at = COALESCE(read_at, now()) " +
    "WHERE id = $1 AND recipient_id = $2 RETURNING id, read_at",
    [notificationId, recipientId],
  );
  return result.rows[0] || null;
}

export async function markAllNotificationsRead(db, recipientId) {
  const result = await db.query(
    "UPDATE notifications SET read_at = now() WHERE recipient_id = $1 AND read_at IS NULL RETURNING id",
    [recipientId],
  );
  return result.rowCount || 0;
}
