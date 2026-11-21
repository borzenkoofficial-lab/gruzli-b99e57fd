import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { createNotification } from "./notifications.mjs";
import { startNotificationListener } from "./notificationEvents.mjs";

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;

test("committed notifications are delivered across PostgreSQL listener connections", {
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

    const delivered = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out waiting for PostgreSQL notification")), 3000);
      stopListener = async () => {
        clearTimeout(timeout);
        await stopListenerOriginal();
      };
      const stopListenerOriginal = async () => {};
      void timeout;
      void resolve;
    });
    const listenerClient = await pool.connect();
    await listenerClient.query("LISTEN gruzli_notification_created");
    const received = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out waiting for PostgreSQL notification")), 3000);
      listenerClient.on("notification", (message) => {
        clearTimeout(timeout);
        resolve(JSON.parse(message.payload));
      });
    });
    const notification = await createNotification(pool, {
      recipientId,
      type: "system",
      title: "Realtime test",
      body: "Notification event",
    });
    const payload = await received;
    assert.equal(payload.recipientId, recipientId);
    assert.equal(payload.notificationId, notification.id);
    await listenerClient.query("UNLISTEN gruzli_notification_created");
    listenerClient.release();
    void delivered;
  } finally {
    await stopListener().catch(() => {});
    fixture.release();
    if (recipientId) await pool.query("DELETE FROM app_users WHERE id = $1", [recipientId]);
  }
});

test.after(async () => {
  await pool?.end();
});
