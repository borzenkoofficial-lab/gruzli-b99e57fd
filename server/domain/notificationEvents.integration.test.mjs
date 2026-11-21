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
  let timeout;
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

    let expectedNotificationId = null;
    let resolveEvent;
    const eventPromise = new Promise((resolve) => { resolveEvent = resolve; });
    stopListener = await startNotificationListener(pool, (event) => {
      // The shared PostgreSQL listener can receive events from other tests.
      // Wait for this fixture's exact recipient + notification pair.
      if (event.recipientId === recipientId && event.notification?.id === expectedNotificationId) {
        resolveEvent(event);
      }
    });

    const notification = await createNotification(pool, {
      recipientId,
      type: "system",
      title: "Realtime test",
      body: "Notification event",
    });
    expectedNotificationId = notification.id;
    const event = await Promise.race([
      eventPromise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Timed out waiting for notification event")), 3000);
      }),
    ]);
    clearTimeout(timeout);
    assert.equal(event.recipientId, recipientId);
    assert.equal(event.notification.id, notification.id);
    assert.equal(event.unreadCount, 1);
  } finally {
    clearTimeout(timeout);
    await stopListener().catch(() => {});
    fixture.release();
    if (recipientId) await pool.query("DELETE FROM app_users WHERE id = $1", [recipientId]);
  }
});

test.after(async () => {
  await pool?.end();
});
