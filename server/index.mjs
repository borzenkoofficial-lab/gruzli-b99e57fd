import crypto from "node:crypto";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pool } from "./db.mjs";
import { migrateDatabase } from "./migrate.mjs";

const scrypt = promisify(crypto.scrypt);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const SESSION_COOKIE = "gruzli_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const distDir = path.join(projectRoot, "dist");
let databaseReady = false;

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: "1mb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Слишком много попыток. Попробуйте позже." } },
});

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}
function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}
function generateRecoveryCode() {
  return crypto.randomBytes(5).toString("hex").toUpperCase();
}
function normalizeIdentifier(value) {
  const raw = String(value || "").trim();
  if (/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(raw)) return normalizeEmail(raw);
  const digits = raw.replace(/\\D/g, "");
  return digits ? digits + "@phone.gruzli.app" : "";
}
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return "scrypt$32768$8$1$" + salt.toString("hex") + "$" + Buffer.from(derived).toString("hex");
}
async function verifyPassword(password, stored) {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const expected = Buffer.from(parts[5], "hex");
    const actual = Buffer.from(await scrypt(password, Buffer.from(parts[4], "hex"), expected.length, {
      N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]), maxmem: 64 * 1024 * 1024,
    }));
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS,
  };
}
async function createSession(userId, db = pool) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.query(
    "INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, hashToken(token), expiresAt],
  );
  return token;
}
function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) {
      try { return decodeURIComponent(part.slice(index + 1).trim()); } catch { return null; }
    }
  }
  return null;
}
async function loadSession(req) {
  if (!pool) return null;
  const token = readCookie(req, SESSION_COOKIE);
  if (!token || token.length > 256) return null;
  const result = await pool.query(
    "SELECT u.id, u.email, u.phone, u.role, p.full_name, p.birth_date, p.avatar_url, p.rating, p.completed_orders, p.total_earned, p.balance, p.skills " +
    "FROM user_sessions s JOIN app_users u ON u.id = s.user_id JOIN profiles p ON p.user_id = u.id " +
    "WHERE s.token_hash = $1 AND s.expires_at > now() AND u.is_active = true LIMIT 1",
    [hashToken(token)],
  );
  return result.rows[0] || null;
}
function publicUser(row) {
  return { id: row.id, email: row.email, phone: row.phone, user_metadata: { role: row.role, full_name: row.full_name } };
}
function publicProfile(row) {
  return {
    user_id: row.id, full_name: row.full_name, phone: row.phone, role: row.role,
    birth_date: row.birth_date, avatar_url: row.avatar_url, rating: Number(row.rating || 0),
    completed_orders: row.completed_orders || 0, total_earned: Number(row.total_earned || 0),
    balance: Number(row.balance || 0), skills: row.skills || [],
  };
}

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "gruzli-api",
    database: databaseReady ? "connected" : "not_configured_or_unavailable",
    timestamp: new Date().toISOString(),
  });
});
app.get("/api/health/db", async (_req, res) => {
  if (!pool || !databaseReady) return sendError(res, 503, "DATABASE_UNAVAILABLE", "База данных Amvera пока не подключена или недоступна.");
  try {
    await pool.query("SELECT 1");
    return res.json({ status: "ok", database: "connected" });
  } catch {
    databaseReady = false;
    return sendError(res, 503, "DATABASE_UNAVAILABLE", "Нет соединения с базой данных.");
  }
});

app.post("/api/auth/register", authLimiter, async (req, res) => {
  if (!pool || !databaseReady) return sendError(res, 503, "DATABASE_UNAVAILABLE", "Регистрация временно недоступна.");
  const fullName = String(req.body?.fullName || "").trim();
  const email = normalizeEmail(req.body?.email);
  const phone = String(req.body?.phone || "").trim() || null;
  const password = String(req.body?.password || "");
  const role = String(req.body?.role || "client");
  const birthDate = req.body?.birthDate ? String(req.body.birthDate) : null;
  if (fullName.length < 2 || fullName.length > 120) return sendError(res, 400, "INVALID_NAME", "Укажите корректное ФИО.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/@phone\.gruzli\.app$/.test(email)) return sendError(res, 400, "INVALID_EMAIL", "Укажите корректный email или номер телефона.");
  if (password.length < 8 || password.length > 128) return sendError(res, 400, "INVALID_PASSWORD", "Пароль должен содержать от 8 до 128 символов.");
  if (!["client", "worker", "dispatcher"].includes(role)) return sendError(res, 400, "INVALID_ROLE", "Выбрана недопустимая роль.");
  if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return sendError(res, 400, "INVALID_BIRTH_DATE", "Некорректная дата рождения.");

  const client = await pool.connect();
  try {
    const passwordHash = await hashPassword(password);
    const recoveryCode = generateRecoveryCode();
    const recoveryCodeHash = await hashPassword(recoveryCode);
    await client.query("BEGIN");
    const inserted = await client.query(
      "INSERT INTO app_users (email, phone, password_hash, recovery_code_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, phone, role",
      [email, phone, passwordHash, recoveryCodeHash, role],
    );
    const user = inserted.rows[0];
    await client.query("INSERT INTO profiles (user_id, full_name, birth_date) VALUES ($1, $2, $3)", [user.id, fullName, birthDate]);
    const sessionToken = await createSession(user.id, client);
    await client.query(
      "INSERT INTO app_audit_log (actor_user_id, action, entity_type, entity_id, ip_address) VALUES ($1, 'auth.register', 'user', $1::text, $2)",
      [user.id, req.ip],
    );
    await client.query("COMMIT");
    res.cookie(SESSION_COOKIE, sessionToken, cookieOptions());
    return res.status(201).json({
      user: { id: user.id, email: user.email, phone: user.phone, user_metadata: { role: user.role, full_name: fullName } },
      role: user.role,
      profile: { user_id: user.id, full_name: fullName, phone: user.phone, role: user.role, birth_date: birthDate },
      recoveryCode,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") return sendError(res, 409, "ACCOUNT_EXISTS", "Аккаунт с таким email или телефоном уже существует.");
    console.error("[auth] Registration failed:", error.message);
    return sendError(res, 500, "REGISTRATION_FAILED", "Не удалось создать аккаунт. Попробуйте позже.");
  } finally {
    client.release();
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  if (!pool || !databaseReady) return sendError(res, 503, "DATABASE_UNAVAILABLE", "Вход временно недоступен.");
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  if (!email || !password) return sendError(res, 400, "MISSING_CREDENTIALS", "Укажите email/телефон и пароль.");
  try {
    const result = await pool.query(
      "SELECT u.id, u.email, u.phone, u.role, u.password_hash, p.full_name, p.birth_date, p.avatar_url, p.rating, p.completed_orders, p.total_earned, p.balance, p.skills " +
      "FROM app_users u JOIN profiles p ON p.user_id = u.id WHERE u.email = $1 AND u.is_active = true LIMIT 1",
      [email],
    );
    const row = result.rows[0];
    if (!row || !(await verifyPassword(password, row.password_hash))) return sendError(res, 401, "INVALID_CREDENTIALS", "Неверный email/телефон или пароль.");
    const sessionToken = await createSession(row.id);
    await pool.query("UPDATE app_users SET last_login_at = now() WHERE id = $1", [row.id]);
    await pool.query(
      "INSERT INTO app_audit_log (actor_user_id, action, entity_type, entity_id, ip_address) VALUES ($1, 'auth.login', 'user', $1::text, $2)",
      [row.id, req.ip],
    );
    res.cookie(SESSION_COOKIE, sessionToken, cookieOptions());
    return res.json({ user: publicUser(row), role: row.role, profile: publicProfile(row) });
  } catch (error) {
    console.error("[auth] Login failed:", error.message);
    return sendError(res, 500, "LOGIN_FAILED", "Не удалось выполнить вход. Попробуйте позже.");
  }
});


app.post("/api/auth/recovery", authLimiter, async (req, res) => {
  if (!pool || !databaseReady) return sendError(res, 503, "DATABASE_UNAVAILABLE", "Восстановление пароля временно недоступно.");
  const identifier = normalizeIdentifier(req.body?.identifier);
  const recoveryCode = String(req.body?.recoveryCode || "").trim().toUpperCase();
  const newPassword = String(req.body?.newPassword || "");
  if (!identifier || !/^[A-F0-9]{10}$/.test(recoveryCode) || newPassword.length < 8 || newPassword.length > 128) {
    return sendError(res, 400, "INVALID_RECOVERY_DATA", "Проверьте телефон/email, код восстановления и пароль (не менее 8 символов).");
  }
  try {
    const result = await pool.query(
      "SELECT id, recovery_code_hash FROM app_users WHERE (email = $1 OR phone = $2) AND is_active = true LIMIT 1",
      [identifier, String(req.body?.identifier || "").trim() || null],
    );
    const row = result.rows[0];
    if (!row?.recovery_code_hash || !(await verifyPassword(recoveryCode, row.recovery_code_hash))) {
      return sendError(res, 400, "INVALID_RECOVERY_CODE", "Неверный телефон/email или код восстановления.");
    }
    const nextCode = generateRecoveryCode();
    const [passwordHash, recoveryCodeHash] = await Promise.all([
      hashPassword(newPassword),
      hashPassword(nextCode),
    ]);
    await pool.query(
      "UPDATE app_users SET password_hash = $1, recovery_code_hash = $2, updated_at = now() WHERE id = $3",
      [passwordHash, recoveryCodeHash, row.id],
    );
    await pool.query("DELETE FROM user_sessions WHERE user_id = $1", [row.id]);
    return res.json({ success: true, newRecoveryCode: nextCode });
  } catch (error) {
    console.error("[auth] Password recovery failed:", error.message);
    return sendError(res, 500, "RECOVERY_FAILED", "Не удалось восстановить пароль. Попробуйте позже.");
  }
});

app.get("/api/auth/me", async (req, res) => {
  if (!pool || !databaseReady) return sendError(res, 503, "DATABASE_UNAVAILABLE", "Сервис авторизации временно недоступен.");
  try {
    const row = await loadSession(req);
    if (!row) return sendError(res, 401, "UNAUTHENTICATED", "Требуется войти в аккаунт.");
    return res.json({ user: publicUser(row), role: row.role, profile: publicProfile(row) });
  } catch (error) {
    console.error("[auth] Session lookup failed:", error.message);
    return sendError(res, 500, "SESSION_LOOKUP_FAILED", "Не удалось проверить сессию.");
  }
});

app.post("/api/auth/logout", async (req, res) => {
  const token = readCookie(req, SESSION_COOKIE);
  if (pool && token) {
    await pool.query("DELETE FROM user_sessions WHERE token_hash = $1", [hashToken(token)]).catch((error) => {
      console.error("[auth] Session revoke failed:", error.message);
    });
  }
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true", sameSite: "lax", path: "/" });
  return res.status(204).end();
});

app.use("/api", (_req, res) => sendError(res, 404, "API_ROUTE_NOT_FOUND", "API-маршрут не найден."));
app.use(express.static(distDir, {
  index: false,
  maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
  setHeaders(res, filePath) {
    if (filePath.includes(path.sep + "assets" + path.sep)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  },
}));
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
  return res.sendFile(path.join(distDir, "index.html"), (error) => error && next(error));
});
app.use((error, _req, res, _next) => {
  console.error("[http] Unhandled request error:", error.message);
  if (!res.headersSent) sendError(res, 500, "INTERNAL_SERVER_ERROR", "Внутренняя ошибка сервера.");
});

async function start() {
  if (pool) {
    try {
      await migrateDatabase();
      await pool.query("SELECT 1");
      databaseReady = true;
      console.info("[db] PostgreSQL connected and schema is ready.");
    } catch (error) {
      databaseReady = false;
      console.error("[db] Startup database check failed:", error.message);
    }
  } else {
    console.warn("[db] DATABASE_URL/PGHOST is not configured. API starts in limited mode.");
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.info("[http] GRUZLI listening on 0.0.0.0:" + PORT);
  });
  const shutdown = async (signal) => {
    console.info("[http] " + signal + " received; shutting down.");
    server.close(async () => {
      await pool?.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error) => {
  console.error("[http] Fatal startup error:", error.message);
  process.exit(1);
});
