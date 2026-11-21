import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import {
  createNotification,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications.mjs";

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;

async function createUser(client, suffix) {
  const user = await client.query(
    "INSERT INTO app_users (email, password_hash, role) VALUES ($1,'test-hash','worker') RETURNING id",
    ["notification-" + suffix + "@test.local"],
  );
  await client.query(
    "INSERT INTO profiles (user_id, full_name) VALUES ($1,$2)",
    [user.rows[0].id, "Notification test"],
  );
  return user.rows[0].id;
}

test("notifications persist per recipient, deduplicate, isolate ownership and support read state", {
  skip: !pool,
}, async () => {
  const suffix = Date.now() + "-" + Math.random().toString(16).slice(2);
  const fixture = await pool.connect();
  let recipientId;
  let otherId;
  try {
    await fixture.query("BEGIN");
    recipientId = await createUser(fixture, suffix + "-recipient");
    otherId = await createUser(fixture, suffix + "-other");
    await fixture.query("COMMIT");

    const first = await createNotification(pool, {
      recipientId,
      type: "response",
      title: "Новый отклик",
      body: "Исполнитель откликнулся на заявку",
      entityType: "job_response",
      entityId: "response-" + suffix,
      metadata: { jobId: "job-" + suffix },
      dedupeKey: "response-created:" + suffix,
    });
    assert.ok(first?.id);
    assert.equal(first.read_at, null);

    const duplicate = await createNotification(pool, {
      recipientId,
      type: "response",
      title: "Повтор",
      body: "Не должно создать вторую запись",
      dedupeKey: "response-created:" + suffix,
    });
    assert.equal(duplicate.id, first.id);

    await createNotification(pool, {
      recipientId,
      type: "system",
      title: "Системное уведомление",
      body: "Проверка",
    });
    assert.equal(await getUnreadNotificationCount(pool, recipientId), 2);
    assert.equal(await getUnreadNotificationCount(pool, otherId), 0);

    const page = await listNotifications(pool, recipientId, 1, 0);
    assert.equal(page.length, 1);
    assert.equal(page[0].title, "Системное уведомление");

    assert.equal(await markNotificationRead(pool, otherId, first.id), null);
    const marked = await markNotificationRead(pool, recipientId, first.id);
    assert.ok(marked?.read_at);
    assert.equal(await getUnreadNotificationCount(pool, recipientId), 1);

    assert.equal(await markAllNotificationsRead(pool, recipientId), 1);
    assert.equal(await getUnreadNotificationCount(pool, recipientId), 0);
  } finally {
    fixture.release();
    if (recipientId && otherId) {
      await pool.query("DELETE FROM app_users WHERE id = ANY($1::uuid[])", [[recipientId, otherId]]);
    }
  }
});

test("notification writes participate in the caller transaction and roll back", {
  skip: !pool,
}, async () => {
  const suffix = Date.now() + "-rollback-" + Math.random().toString(16).slice(2);
  const fixture = await pool.connect();
  let recipientId;
  try {
    await fixture.query("BEGIN");
    recipientId = await createUser(fixture, suffix);
    const created = await createNotification(fixture, {
      recipientId,
      type: "system",
      title: "Transactional notification",
      body: "Must roll back",
    });
    assert.ok(created?.id);
    await fixture.query("ROLLBACK");

    const count = await pool.query(
      "SELECT count(*)::int AS count FROM notifications WHERE recipient_id = $1",
      [recipientId],
    );
    assert.equal(count.rows[0].count, 0);
  } finally {
    await fixture.query("ROLLBACK").catch(() => {});
    fixture.release();
    if (recipientId) await pool.query("DELETE FROM app_users WHERE id = $1", [recipientId]);
  }
});

test.after(async () => {
  await pool?.end();
});
