import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";

test("financial ledger prevents duplicate worker earnings and mutation", {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const emailSuffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const clientUser = await client.query(
      "INSERT INTO app_users (email, password_hash, role) VALUES ($1,'test-hash','client') RETURNING id",
      [`client-${emailSuffix}@example.test`],
    );
    const workerUser = await client.query(
      "INSERT INTO app_users (email, password_hash, role) VALUES ($1,'test-hash','worker') RETURNING id",
      [`worker-${emailSuffix}@example.test`],
    );
    await client.query("INSERT INTO profiles (user_id, full_name) VALUES ($1,'Ledger test worker')", [workerUser.rows[0].id]);
    const job = await client.query(
      "INSERT INTO jobs (client_id, title, hourly_rate, workers_needed, status) VALUES ($1,'Ledger integration test',500,1,'finishing') RETURNING id",
      [clientUser.rows[0].id],
    );
    const response = await client.query(
      "INSERT INTO job_responses (job_id, worker_id, status, worker_status, agreed_hourly_rate, hours_worked, earned) " +
      "VALUES ($1,$2,'accepted','completed',500,2,1000) RETURNING id",
      [job.rows[0].id, workerUser.rows[0].id],
    );
    const entry = await client.query(
      "INSERT INTO financial_ledger (user_id, job_id, response_id, entry_type, amount) " +
      "VALUES ($1,$2,$3,'worker_earning',1000) RETURNING id",
      [workerUser.rows[0].id, job.rows[0].id, response.rows[0].id],
    );
    const duplicate = await client.query(
      "INSERT INTO financial_ledger (user_id, job_id, response_id, entry_type, amount) " +
      "VALUES ($1,$2,$3,'worker_earning',1000) ON CONFLICT DO NOTHING RETURNING id",
      [workerUser.rows[0].id, job.rows[0].id, response.rows[0].id],
    );
    assert.equal(duplicate.rowCount, 0, "a response must not produce two worker earning entries");
    await assert.rejects(
      client.query("UPDATE financial_ledger SET amount = 999 WHERE id = $1", [entry.rows[0].id]),
      /financial_ledger_is_immutable/,
    );
    await client.query("ROLLBACK");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
});
