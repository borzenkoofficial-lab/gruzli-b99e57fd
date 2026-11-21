import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { createNotification } from "./notifications.mjs";
import { startNotificationListener } from "./notificationEvents.mjs";

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;

test("committed notifications are delivered through the PostgreSQL event listener", {
  skip: !pool,
}, async () => {
  const suffix = Date.now() + "-" + Math.random().toString(16).slice(2);
  const fixture = await pool.connect();
  let recipientId;
  let stopListener = async () => {};
  try {
    await fixture.query("BEGIN");
    const user = await fixture.query(
      "INSERT INTO app_users (email, password_hash, role) VALUES ($1,'test-hash','worker') RETURNING id",
      ["notification-events-" + suffix + "@test.local"],
    );
    recipientId = user.rows[0].id;
    await fixture.query(
      "INSERT INTO profiles (user_id, full_name) VALUES ($1,'Notification event test')",
      [recipientId],
    );
    await fixture.query("COMMIT");

    let resolveEvent;
    const eventPromise = new Promise((resolve) => { resolveEvent = resolve; });
    stopListener = await startNotificationListener(pool, resolveEvent);

    const notification = await createNotification(pool, {
      recipientId,
      type: "system",
      title: "Realtime test",
      body: "Notification event",
    });
    const event = await Promise.race([
      eventPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for notification event")), 3000)),
    ]);
    assert.equal(event.recipientId, recipientId);
    assert.equal(event.notification.id, notification.id);
    assert.equal(event.unreadCount, 1);
  } finally {
    await stopListener().catch(() => {});
    fixture.release();
    if (recipientId) await pool.query("DELETE FROM app_users WHERE id = $1", [recipientId]);
  }
});

test.after(async () => {
  await pool?.end();
});
