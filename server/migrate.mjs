import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "./db.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "migrations");

export async function migrateDatabase() {
  if (!pool) throw new Error("PostgreSQL is not configured. Set DATABASE_URL or PGHOST/PGDATABASE/PGUSER.");

  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [731904221]);
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");

    const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
    for (const filename of files) {
      const applied = await client.query("SELECT 1 FROM schema_migrations WHERE id = $1", [filename]);
      if (applied.rowCount) continue;

      const sql = await readFile(path.join(migrationsDir, filename), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [filename]);
        await client.query("COMMIT");
        console.info("[db] Applied migration: " + filename);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error("Migration " + filename + " failed: " + error.message, { cause: error });
      }
    }
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [731904221]);
    } finally {
      client.release();
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migrateDatabase()
    .then(async () => {
      console.info("[db] Migrations complete.");
      await pool?.end();
    })
    .catch(async (error) => {
      console.error("[db] Migration failed:", error.message);
      await pool?.end();
      process.exitCode = 1;
    });
}
