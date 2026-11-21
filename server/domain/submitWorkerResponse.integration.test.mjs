import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import {
  FREE_WEEKLY_COMPLETED_JOB_LIMIT,
  WorkerResponseError,
  submitWorkerResponse,
} from "./submitWorkerResponse.mjs";

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;

async function createUser(client, role, suffix, premium = false) {
  const user = await client.query(
    "INSERT INTO app_users (email, password_hash, role) VALUES ($1,'test-hash',$2) RETURNING id",
    [role + "-" + suffix + "@response.test", role],
  );
  const id = user.rows[0].id;
  await client.query(
    "INSERT INTO profiles (user_id, full_name, is_premium) VALUES ($1,$2,$3)",
    [id, role + " response test", premium],
  );
  return id;
}

async function createJob(client, clientId, dispatcherId, title) {
  const result = await client.query(
    "INSERT INTO jobs (client_id, dispatcher_id, title, hourly_rate, workers_needed, status) " +
    "VALUES ($1,$2,$3,500,1,'active') RETURNING id",
    [clientId, dispatcherId, title],
  );
  return result.rows[0].id;
}

async function withFixture(run) {
  if (!pool) return;
  const suffix = Date.now() + "-" + Math.random().toString(16).slice(2);
  const client = await pool.connect();
  let workerId;
  let dispatcherId;
  let clientId;
  try {
    await client.query("BEGIN");
    clientId = await createUser(client, "client", suffix);
    dispatcherId = await createUser(client, "dispatcher", suffix);
    workerId = await createUser(client, "worker", suffix);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  try {
    await run({ workerId, dispatcherId, clientId });
  } finally {
    const userIds = [workerId, dispatcherId, clientId];
    await pool.query(
      "DELETE FROM conversations c WHERE EXISTS (" +
      "SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = c.id AND cp.user_id = ANY($1::uuid[]))",
      [userIds],
    );
    await pool.query("DELETE FROM jobs WHERE client_id = $1", [clientId]);
    await pool.query("DELETE FROM app_users WHERE id = ANY($1::uuid[])", [userIds]);
  }
}

test("worker response creates response, direct chat and first message atomically; duplicate reuses them", {
  skip: !pool,
}, async () => {
  await withFixture(async ({ workerId, dispatcherId, clientId }) => {
    const jobId = await createJob(pool, clientId, dispatcherId, "Перенос мебели");
    const message = "Здравствуйте! Готов выйти на заказ.";
    const first = await submitWorkerResponse({ db: pool, jobId, workerId, message });

    assert.equal(first.existing, false);
    assert.equal(first.response.job_id, jobId);
    assert.equal(first.response.worker_id, workerId);
    assert.ok(first.conversationId);
    assert.equal(first.message.text, message);
    assert.equal(first.message.sender_id, workerId);

    const counts = await pool.query(
      "SELECT (SELECT count(*)::int FROM job_responses WHERE job_id = $1 AND worker_id = $2) AS responses, " +
      "(SELECT count(*)::int FROM messages WHERE conversation_id = $3) AS messages, " +
      "(SELECT count(*)::int FROM conversation_participants WHERE conversation_id = $3) AS participants",
      [jobId, workerId, first.conversationId],
    );
    assert.deepEqual(counts.rows[0], { responses: 1, messages: 1, participants: 2 });

    const duplicate = await submitWorkerResponse({ db: pool, jobId, workerId, message });
    assert.equal(duplicate.existing, true);
    assert.equal(duplicate.response.id, first.response.id);
    assert.equal(duplicate.conversationId, first.conversationId);
    assert.equal(duplicate.message, null);

    const messageCount = await pool.query(
      "SELECT count(*)::int AS count FROM messages WHERE conversation_id = $1",
      [first.conversationId],
    );
    assert.equal(messageCount.rows[0].count, 1);
  });
});

test("free worker weekly limit blocks new submissions after three completed jobs", {
  skip: !pool,
}, async () => {
  await withFixture(async ({ workerId, dispatcherId, clientId }) => {
    const fixture = await pool.connect();
    const suffix = Date.now() + "-quota";
    try {
      await fixture.query("BEGIN");
      for (let index = 0; index < FREE_WEEKLY_COMPLETED_JOB_LIMIT; index += 1) {
        const jobId = await createJob(fixture, clientId, dispatcherId, "Завершённая работа " + index);
        await fixture.query(
          "INSERT INTO job_responses (job_id, worker_id, status, worker_status, work_finished_at) " +
          "VALUES ($1,$2,'accepted','completed',now())",
          [jobId, workerId],
        );
      }
      const jobA = await createJob(fixture, clientId, dispatcherId, "Новый заказ A " + suffix);
      const jobB = await createJob(fixture, clientId, dispatcherId, "Новый заказ B " + suffix);
      await fixture.query("COMMIT");

      const results = await Promise.allSettled([
        submitWorkerResponse({ db: pool, jobId: jobA, workerId, message: "Отклик A" }),
        submitWorkerResponse({ db: pool, jobId: jobB, workerId, message: "Отклик B" }),
      ]);
      const succeeded = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter((result) => result.status === "rejected");
      assert.equal(succeeded.length, 0);
      assert.equal(rejected.length, 2);
      for (const result of rejected) {
        assert.ok(result.reason instanceof WorkerResponseError);
        assert.equal(result.reason.code, "WEEKLY_LIMIT_REACHED");
        assert.equal(result.reason.status, 429);
      }
    } finally {
      await fixture.query("ROLLBACK").catch(() => {});
      fixture.release();
    }
  });
});

test("premium worker is not blocked by the free weekly quota", {
  skip: !pool,
}, async () => {
  await withFixture(async ({ workerId, dispatcherId, clientId }) => {
    await pool.query("UPDATE profiles SET is_premium = true WHERE user_id = $1", [workerId]);
    const fixture = await pool.connect();
    let jobId;
    try {
      await fixture.query("BEGIN");
      for (let index = 0; index < FREE_WEEKLY_COMPLETED_JOB_LIMIT; index += 1) {
        const completedJobId = await createJob(fixture, clientId, dispatcherId, "Premium completed " + index);
        await fixture.query(
          "INSERT INTO job_responses (job_id, worker_id, status, worker_status, work_finished_at) " +
          "VALUES ($1,$2,'accepted','completed',now())",
          [completedJobId, workerId],
        );
      }
      jobId = await createJob(fixture, clientId, dispatcherId, "Premium new job");
      await fixture.query("COMMIT");
      const result = await submitWorkerResponse({ db: pool, jobId, workerId, message: "Готов работать" });
      assert.equal(result.existing, false);
      assert.equal(result.weeklyCompletedJobs, FREE_WEEKLY_COMPLETED_JOB_LIMIT);
    } finally {
      await fixture.query("ROLLBACK").catch(() => {});
      fixture.release();
    }
  });
});

test("blocked direct-chat pair aborts response creation without partial records", {
  skip: !pool,
}, async () => {
  await withFixture(async ({ workerId, dispatcherId, clientId }) => {
    const jobId = await createJob(pool, clientId, dispatcherId, "Заказ с блокировкой");
    await pool.query(
      "INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1,$2)",
      [dispatcherId, workerId],
    );
    await assert.rejects(
      submitWorkerResponse({ db: pool, jobId, workerId, message: "Отклик" }),
      (error) => error instanceof WorkerResponseError && error.code === "CHAT_BLOCKED",
    );
    const responseCount = await pool.query(
      "SELECT count(*)::int AS count FROM job_responses WHERE job_id = $1 AND worker_id = $2",
      [jobId, workerId],
    );
    assert.equal(responseCount.rows[0].count, 0);
  });
});

test("missing job returns a typed domain error", {
  skip: !pool,
}, async () => {
  await withFixture(async ({ workerId }) => {
    await assert.rejects(
      submitWorkerResponse({ db: pool, jobId: "00000000-0000-4000-8000-000000000000", workerId, message: "Отклик" }),
      (error) => error instanceof WorkerResponseError && error.code === "JOB_NOT_FOUND",
    );
  });
});

test.after(async () => {
  await pool?.end();
});
