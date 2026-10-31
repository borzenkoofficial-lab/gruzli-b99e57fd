import pg from "pg";

const { Pool } = pg;

function createPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PGPOOL_MAX || 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ...(process.env.PGSSLMODE === "require"
        ? { ssl: { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== "false" } }
        : {}),
    });
  }

  if (process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER) {
    return new Pool({
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      max: Number(process.env.PGPOOL_MAX || 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ...(process.env.PGSSLMODE === "require"
        ? { ssl: { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== "false" } }
        : {}),
    });
  }

  return null;
}

export const pool = createPool();

if (pool) {
  pool.on("error", (error) => {
    console.error("[db] Unexpected idle client error:", error.message);
  });
}
