import crypto from "node:crypto";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { promisify } from "node:util";
import path from "node:path";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { pool } from "./db.mjs";
import { migrateDatabase } from "./migrate.mjs";
import { calculateWorkerEarnings, isWorkerStatusTransitionAllowed, normalizeWorkedHours } from "./domain/workerLifecycle.mjs";
import { submitWorkerResponse, WorkerResponseError } from "./domain/submitWorkerResponse.mjs";
import { listNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead } from "./domain/notifications.mjs";
import { startNotificationListener } from "./domain/notificationEvents.mjs";

const scrypt = promisify(crypto.scrypt);
const app = express();
const realtime = new WebSocketServer({ noServer: true, maxPayload: 16384 });
const userSockets = new Map();
const socketConversations = new WeakMap();
function sendSocket(socket, event) { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event)); }
function sendRoleEvent(role, event) { for (const sockets of userSockets.values()) for (const socket of sockets) if (socket.userRole === role || socket.userRole === "admin") sendSocket(socket, event); }
function sendUserEvent(userId, event) { for (const socket of userSockets.get(userId) || []) sendSocket(socket, event); }
function sendConversationEvent(conversationId, event, exceptUserId = null) {
  for (const [userId, sockets] of userSockets) {
    if (userId === exceptUserId) continue;
    for (const socket of sockets) if (socketConversations.get(socket)?.has(conversationId)) sendSocket(socket, event);
  }
}

async function publishPresence(userId, isOnline) {
  if (!pool || !databaseReady) return;
  try {
    const result = await pool.query(
      "UPDATE profiles SET is_online = $2, last_seen_at = now(), updated_at = now() WHERE user_id = $1 RETURNING last_seen_at",
      [userId, isOnline],
    );
    if (!result.rowCount) return;
    const peers = await pool.query(
      "SELECT DISTINCT peer.user_id FROM conversation_participants mine " +
      "JOIN conversation_participants peer ON peer.conversation_id = mine.conversation_id " +
      "WHERE mine.user_id = $1 AND peer.user_id <> $1",
      [userId],
    );
    const event = { type: "presence:update", userId, lastSeenAt: result.rows[0].last_seen_at, isOnline };
    for (const peer of peers.rows) sendUserEvent(peer.user_id, event);
  } catch (error) {
    console.error("[presence] Realtime update failed:", error.message);
  }
}
const PORT = Number(process.env.PORT || 3000);
const SESSION_COOKIE = "gruzli_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const distDir = path.join(projectRoot, "dist");
const dataDir = path.resolve(process.env.DATA_DIR || path.join(projectRoot, ".data"));
const uploadDir = path.join(dataDir, "uploads");
const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime)|audio\/(webm|ogg|mpeg|wav|mp4|aac)|application\/(pdf|msword|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet))$/i;
    callback(allowed.test(file.mimetype) ? null : new Error("UNSUPPORTED_FILE_TYPE"));
  },
});
let databaseReady = false;
let stopNotificationListener = async () => {};

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
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return normalizeEmail(raw);
  const digits = raw.replace(/\D/g, "");
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


async function requireAuth(req, res, next) {
  if (!pool || !databaseReady) return sendError(res, 503, "DATABASE_UNAVAILABLE", "База данных временно недоступна.");
  try {
    const authUser = await loadSession(req);
    if (!authUser) return sendError(res, 401, "UNAUTHENTICATED", "Требуется войти в аккаунт.");
    req.authUser = authUser;
    return next();
  } catch (error) {
    console.error("[auth] Protected request failed:", error.message);
    return sendError(res, 500, "AUTH_CHECK_FAILED", "Не удалось проверить доступ.");
  }
}


app.get("/api/notifications", requireAuth, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, Math.min(10000, Number.parseInt(req.query.offset, 10) || 0));
    const [notifications, unreadCount] = await Promise.all([
      listNotifications(pool, req.authUser.id, limit, offset),
      getUnreadNotificationCount(pool, req.authUser.id),
    ]);
    return res.json({ notifications, unreadCount, limit, offset });
  } catch (error) {
    console.error("[notifications] List failed:", error.message);
    return sendError(res, 500, "NOTIFICATIONS_LIST_FAILED", "Не удалось загрузить уведомления.");
  }
});

app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
  try {
    const unreadCount = await getUnreadNotificationCount(pool, req.authUser.id);
    return res.json({ unreadCount });
  } catch (error) {
    console.error("[notifications] Unread count failed:", error.message);
    return sendError(res, 500, "NOTIFICATIONS_COUNT_FAILED", "Не удалось получить счётчик уведомлений.");
  }
});

app.patch("/api/notifications/read-all", requireAuth, async (req, res) => {
  try {
    const updatedCount = await markAllNotificationsRead(pool, req.authUser.id);
    sendUserEvent(req.authUser.id, { type: "notifications:read", scope: "all" });
    return res.json({ updatedCount, unreadCount: 0 });
  } catch (error) {
    console.error("[notifications] Read-all failed:", error.message);
    return sendError(res, 500, "NOTIFICATIONS_READ_FAILED", "Не удалось отметить уведомления прочитанными.");
  }
});

app.patch("/api/notifications/:notificationId/read", requireAuth, async (req, res) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.notificationId)) {
    return sendError(res, 404, "NOTIFICATION_NOT_FOUND", "Уведомление не найдено.");
  }
  try {
    const notification = await markNotificationRead(pool, req.authUser.id, req.params.notificationId);
    if (!notification) return sendError(res, 404, "NOTIFICATION_NOT_FOUND", "Уведомление не найдено.");
    const unreadCount = await getUnreadNotificationCount(pool, req.authUser.id);
    sendUserEvent(req.authUser.id, { type: "notifications:read", notificationId: notification.id, unreadCount });
    return res.json({ notification, unreadCount });
  } catch (error) {
    console.error("[notifications] Read failed:", error.message);
    return sendError(res, 500, "NOTIFICATION_READ_FAILED", "Не удалось отметить уведомление прочитанным.");
  }
});

app.post("/api/profile/presence", requireAuth, async (req, res) => {
  try {
    const updated = await pool.query(
      "UPDATE profiles SET is_online = true, last_seen_at = now(), updated_at = now() WHERE user_id = $1 RETURNING last_seen_at",
      [req.authUser.id],
    );
    const lastSeenAt = updated.rows[0]?.last_seen_at;
    if (lastSeenAt) {
      const peers = await pool.query(
        "SELECT DISTINCT peer.user_id FROM conversation_participants mine " +
        "JOIN conversation_participants peer ON peer.conversation_id = mine.conversation_id " +
        "WHERE mine.user_id = $1 AND peer.user_id <> $1",
        [req.authUser.id],
      );
      const event = { type: "presence:update", userId: req.authUser.id, lastSeenAt, isOnline: true };
      for (const peer of peers.rows) sendUserEvent(peer.user_id, event);
    }
    return res.status(204).end();
  } catch (error) {
    console.error("[profile] Presence update failed:", error.message);
    return sendError(res, 500, "PRESENCE_UPDATE_FAILED", "Не удалось обновить статус присутствия.");
  }
});



function uploadSingleChatFile(req, res, next) {
  chatUpload.single("file")(req, res, (error) => {
    if (!error) return next();
    if (error.code === "LIMIT_FILE_SIZE") return sendError(res, 413, "FILE_TOO_LARGE", "Файл превышает лимит 25 МБ.");
    if (error.message === "UNSUPPORTED_FILE_TYPE") return sendError(res, 415, "UNSUPPORTED_FILE_TYPE", "Этот формат файла нельзя отправить в чат.");
    return sendError(res, 400, "INVALID_UPLOAD", "Не удалось принять файл.");
  });
}

async function requireConversationMember(conversationId, userId) {
  const result = await pool.query(
    "SELECT c.id, c.title, c.is_group, c.job_id, cp.last_read_at FROM conversations c " +
    "JOIN conversation_participants cp ON cp.conversation_id = c.id " +
    "WHERE c.id = $1 AND cp.user_id = $2 LIMIT 1",
    [conversationId, userId],
  );
  return result.rows[0] || null;
}


app.post("/api/conversations", requireAuth, async (req, res) => {
  const requestedIds = Array.isArray(req.body?.participantIds) ? req.body.participantIds : [];
  const participantIds = [...new Set([req.authUser.id, ...requestedIds.map((id) => String(id))])];
  const title = String(req.body?.title || "").trim().slice(0, 120) || null;
  const isGroup = Boolean(req.body?.isGroup) || participantIds.length > 2;
  if (participantIds.length < 2 || participantIds.length > 30) {
    return sendError(res, 400, "INVALID_PARTICIPANTS", "В диалоге должно быть от 2 до 30 участников.");
  }
  if (participantIds.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
    return sendError(res, 400, "INVALID_PARTICIPANT_ID", "Некорректный идентификатор участника.");
  }
  if (!isGroup && participantIds.length !== 2) return sendError(res, 400, "INVALID_DIRECT_CHAT", "Личный диалог может содержать только двух участников.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (!isGroup) {
      const pairKey = participantIds.slice().sort().join(":");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        ["direct-chat:" + pairKey],
      );
    }
    const users = await client.query(
      "SELECT id FROM app_users WHERE id = ANY($1::uuid[]) AND is_active = true",
      [participantIds],
    );
    if (users.rowCount !== participantIds.length) {
      await client.query("ROLLBACK");
      return sendError(res, 400, "INVALID_PARTICIPANT", "Один из участников не найден или заблокирован.");
    }
    const blocked = await client.query(
      "SELECT 1 FROM blocked_users WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1",
      [participantIds[0], participantIds[1]],
    );
    if (blocked.rowCount) {
      await client.query("ROLLBACK");
      return sendError(res, 403, "CHAT_BLOCKED", "Нельзя создать диалог: один из участников добавил другого в чёрный список.");
    }
    if (!isGroup) {
      const existing = await client.query(
        "SELECT c.id FROM conversations c JOIN conversation_participants a ON a.conversation_id = c.id AND a.user_id = $1 " +
        "JOIN conversation_participants b ON b.conversation_id = c.id AND b.user_id = $2 " +
        "WHERE c.is_group = false AND (SELECT count(*) FROM conversation_participants x WHERE x.conversation_id = c.id) = 2 LIMIT 1",
        participantIds,
      );
      if (existing.rowCount) {
        await client.query("COMMIT");
        return res.json({ conversationId: existing.rows[0].id, existing: true });
      }
    }
    const created = await client.query(
      "INSERT INTO conversations (title, is_group, created_by) VALUES ($1,$2,$3) RETURNING id",
      [title, isGroup, req.authUser.id],
    );
    await client.query(
      "INSERT INTO conversation_participants (conversation_id, user_id) SELECT $1, unnest($2::uuid[])",
      [created.rows[0].id, participantIds],
    );
    await client.query("COMMIT");
    return res.status(201).json({ conversationId: created.rows[0].id, existing: false });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[chat] Conversation create failed:", error.message);
    return sendError(res, 500, "CONVERSATION_CREATE_FAILED", "Не удалось создать диалог.");
  } finally {
    client.release();
  }
});

app.delete("/api/conversations/:conversationId", requireAuth, async (req, res) => {
  try {
    const member = await requireConversationMember(req.params.conversationId, req.authUser.id);
    if (!member && req.authUser.role !== "admin") return sendError(res, 404, "CONVERSATION_NOT_FOUND", "Диалог не найден.");
    const storedFiles = await pool.query("SELECT storage_key FROM conversation_files WHERE conversation_id = $1", [req.params.conversationId]);
    const deleted = await pool.query("DELETE FROM conversations WHERE id = $1 RETURNING id", [req.params.conversationId]);
    if (!deleted.rowCount) return sendError(res, 404, "CONVERSATION_NOT_FOUND", "Диалог не найден.");
    await Promise.all(storedFiles.rows.map((file) => unlink(path.join(uploadDir, file.storage_key)).catch((error) => {
      if (error.code !== "ENOENT") console.error("[storage] File cleanup failed:", error.message);
    })));
    return res.status(204).end();
  } catch (error) {
    console.error("[chat] Conversation delete failed:", error.message);
    return sendError(res, 500, "CONVERSATION_DELETE_FAILED", "Не удалось удалить диалог.");
  }
});

app.post("/api/conversations/:conversationId/block", requireAuth, async (req, res) => {
  try {
    const member = await requireConversationMember(req.params.conversationId, req.authUser.id);
    if (!member) return sendError(res, 404, "CONVERSATION_NOT_FOUND", "Диалог не найден.");
    const other = await pool.query(
      "SELECT user_id FROM conversation_participants WHERE conversation_id = $1 AND user_id <> $2 ORDER BY joined_at LIMIT 1",
      [req.params.conversationId, req.authUser.id],
    );
    if (!other.rowCount) return sendError(res, 400, "NO_BLOCK_TARGET", "В этом диалоге нет другого участника.");
    await pool.query(
      "INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [req.authUser.id, other.rows[0].user_id],
    );
    return res.json({ success: true });
  } catch (error) {
    console.error("[chat] Block user failed:", error.message);
    return sendError(res, 500, "BLOCK_USER_FAILED", "Не удалось добавить пользователя в чёрный список.");
  }
});

app.get("/api/conversations", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT c.id, c.title, c.is_group, c.job_id, c.created_at, " +
      "CASE WHEN c.is_group THEN COALESCE(c.title, 'Группа') ELSE COALESCE(op.full_name, c.title, 'Чат') END AS other_name, " +
      "CASE WHEN c.is_group THEN NULL ELSE op.avatar_url END AS other_avatar_url, " +
      "op.user_id AS other_user_id, op.last_seen_at AS other_last_seen, (op.is_online AND op.last_seen_at >= now() - interval '2 minutes') AS other_is_online, lm.text AS last_message_text, lm.message_type AS last_message_type, " +
      "lm.created_at AS last_message_at, lm.sender_id AS last_sender_id, " +
      "COALESCE(unread.unread_count, 0)::int AS unread_count " +
      "FROM conversation_participants mine JOIN conversations c ON c.id = mine.conversation_id " +
      "LEFT JOIN LATERAL (SELECT cp.user_id, p.full_name, p.avatar_url, p.last_seen_at, p.is_online FROM conversation_participants cp " +
      "JOIN profiles p ON p.user_id = cp.user_id WHERE cp.conversation_id = c.id AND cp.user_id <> $1 ORDER BY cp.joined_at LIMIT 1) op ON true " +
      "LEFT JOIN LATERAL (SELECT m.text, m.message_type, m.created_at, m.sender_id FROM messages m " +
      "WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) lm ON true " +
      "LEFT JOIN LATERAL (SELECT count(*)::int AS unread_count FROM messages m WHERE m.conversation_id = c.id " +
      "AND m.sender_id <> $1 AND (mine.last_read_at IS NULL OR m.created_at > mine.last_read_at)) unread ON true " +
      "WHERE mine.user_id = $1 ORDER BY COALESCE(lm.created_at, c.created_at) DESC LIMIT 200",
      [req.authUser.id],
    );
    const conversations = result.rows.map((row) => ({
      id: row.id, title: row.title, is_group: row.is_group, job_id: row.job_id,
      otherUserId: row.other_user_id, otherName: row.other_name, otherAvatarUrl: row.other_avatar_url, otherLastSeen: row.other_last_seen, otherIsOnline: Boolean(row.other_is_online),
      lastMessage: row.last_message_type === "voice" ? "🎤 Голосовое сообщение" :
        row.last_message_type === "image" ? "📷 Фото" : row.last_message_type === "video" ? "📹 Видео" :
        row.last_message_type === "sticker" ? (row.last_message_text || "Стикер") : (row.last_message_text || "Нет сообщений"),
      lastTime: row.last_message_at ? new Date(row.last_message_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "",
      lastTimestamp: row.last_message_at || row.created_at, unreadCount: row.unread_count,
      isCommunity: false,
    }));
    return res.json({ conversations });
  } catch (error) {
    console.error("[chat] Conversation list failed:", error.message);
    return sendError(res, 500, "CONVERSATIONS_LIST_FAILED", "Не удалось загрузить список диалогов.");
  }
});

app.get("/api/conversations/:conversationId", requireAuth, async (req, res) => {
  try {
    const conversation = await requireConversationMember(req.params.conversationId, req.authUser.id);
    if (!conversation) return sendError(res, 404, "CONVERSATION_NOT_FOUND", "Диалог не найден.");
    const participants = await pool.query(
      "SELECT u.id, p.full_name, p.avatar_url, p.last_seen_at, (p.is_online AND p.last_seen_at >= now() - interval '2 minutes') AS is_online FROM conversation_participants cp " +
      "JOIN app_users u ON u.id = cp.user_id JOIN profiles p ON p.user_id = u.id " +
      "WHERE cp.conversation_id = $1 AND cp.user_id <> $2 ORDER BY cp.joined_at",
      [conversation.id, req.authUser.id],
    );
    return res.json({ conversation, participants: participants.rows });
  } catch (error) {
    console.error("[chat] Conversation detail failed:", error.message);
    return sendError(res, 500, "CONVERSATION_LOOKUP_FAILED", "Не удалось загрузить диалог.");
  }
});


app.post("/api/conversations/:conversationId/files", requireAuth, uploadSingleChatFile, async (req, res) => {
  const file = req.file;
  if (!file) return sendError(res, 400, "FILE_REQUIRED", "Выберите файл для отправки.");
  try {
    const conversation = await requireConversationMember(req.params.conversationId, req.authUser.id);
    if (!conversation) return sendError(res, 404, "CONVERSATION_NOT_FOUND", "Диалог не найден.");
    const blocked = await pool.query(
      "SELECT 1 FROM blocked_users b JOIN conversation_participants cp ON cp.conversation_id = $1 AND cp.user_id = b.blocked_id WHERE b.blocker_id = $2 LIMIT 1",
      [conversation.id, req.authUser.id],
    );
    if (blocked.rowCount) return sendError(res, 403, "USER_BLOCKED", "Нельзя отправить файл этому пользователю.");

    const extensionByMime = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
      "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
      "audio/webm": "webm", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/wav": "wav",
      "audio/mp4": "m4a", "audio/aac": "aac", "application/pdf": "pdf", "application/msword": "doc", "application/vnd.ms-excel": "xls",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    };
    const extension = extensionByMime[file.mimetype];
    if (!extension) return sendError(res, 415, "UNSUPPORTED_FILE_TYPE", "Этот формат файла нельзя отправить в чат.");

    await mkdir(uploadDir, { recursive: true });
    const fileId = crypto.randomUUID();
    const storageKey = fileId + "." + extension;
    const diskPath = path.join(uploadDir, storageKey);
    await writeFile(diskPath, file.buffer, { flag: "wx", mode: 0o600 });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO conversation_files (id, conversation_id, uploaded_by, storage_key, original_name, mime_type, byte_size) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [fileId, conversation.id, req.authUser.id, storageKey, path.basename(file.originalname).slice(0, 240), file.mimetype, file.size],
      );
      const messageType = file.mimetype.startsWith("image/") ? "image" :
        file.mimetype.startsWith("video/") ? "video" :
        file.mimetype.startsWith("audio/") ? "voice" : "file";
      const messageText = messageType === "voice"
        ? "voice:" + Math.max(0, Math.min(3600, Number(req.body?.duration) || 0))
        : path.basename(file.originalname).slice(0, 240);
      const inserted = await client.query(
        "INSERT INTO messages (conversation_id, sender_id, text, media_url, message_type) VALUES ($1,$2,$3,$4,$5) RETURNING id, conversation_id, sender_id, text, media_url, message_type, reply_to_id, created_at",
        [conversation.id, req.authUser.id, messageText, "/api/files/" + fileId, messageType],
      );
      await client.query(
        "INSERT INTO message_receipts (message_id, recipient_id) SELECT $1, user_id FROM conversation_participants WHERE conversation_id = $2 AND user_id <> $3 ON CONFLICT DO NOTHING",
        [inserted.rows[0].id, conversation.id, req.authUser.id],
      );
      await client.query("UPDATE conversation_participants SET last_read_at = now() WHERE conversation_id = $1 AND user_id = $2", [conversation.id, req.authUser.id]);
      await client.query("COMMIT");
      const message = { ...inserted.rows[0], sender_name: req.authUser.full_name };
      sendConversationEvent(conversation.id, { type: "message:new", conversationId: conversation.id, message }, req.authUser.id);
      return res.status(201).json({ message, file: { id: fileId, name: path.basename(file.originalname), size: file.size, mimeType: file.mimetype } });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      await unlink(diskPath).catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[storage] Chat upload failed:", error.message);
    return sendError(res, 500, "FILE_UPLOAD_FAILED", "Не удалось сохранить файл.");
  }
});

app.get("/api/files/:fileId", requireAuth, async (req, res) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.fileId)) {
    return sendError(res, 404, "FILE_NOT_FOUND", "Файл не найден.");
  }
  try {
    const result = await pool.query(
      "SELECT f.storage_key, f.original_name, f.mime_type FROM conversation_files f " +
      "JOIN conversation_participants cp ON cp.conversation_id = f.conversation_id AND cp.user_id = $2 " +
      "WHERE f.id = $1 LIMIT 1",
      [req.params.fileId, req.authUser.id],
    );
    if (!result.rowCount) return sendError(res, 404, "FILE_NOT_FOUND", "Файл не найден.");
    const file = result.rows[0];
    res.setHeader("Content-Type", file.mime_type);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    const disposition = file.mime_type.startsWith("image/") || file.mime_type.startsWith("video/") || file.mime_type.startsWith("audio/") ? "inline" : "attachment";
    res.setHeader("Content-Disposition", disposition + "; filename*=UTF-8''" + encodeURIComponent(file.original_name));
    return res.sendFile(path.join(uploadDir, file.storage_key), (error) => {
      if (error && !res.headersSent) sendError(res, 404, "FILE_NOT_FOUND", "Файл не найден в хранилище.");
    });
  } catch (error) {
    console.error("[storage] Chat download failed:", error.message);
    return sendError(res, 500, "FILE_DOWNLOAD_FAILED", "Не удалось получить файл.");
  }
});

app.get("/api/conversations/:conversationId/messages", requireAuth, async (req, res) => {
  try {
    const conversation = await requireConversationMember(req.params.conversationId, req.authUser.id);
    if (!conversation) return sendError(res, 404, "CONVERSATION_NOT_FOUND", "Диалог не найден.");
    const result = await pool.query(
      "SELECT m.id, m.conversation_id, m.sender_id, m.text, m.media_url, m.message_type, m.reply_to_id, m.created_at, p.full_name AS sender_name, " +
      "COALESCE(receipts.recipient_count, 0)::int AS receipt_total, COALESCE(receipts.delivered_count, 0)::int AS receipt_delivered, COALESCE(receipts.read_count, 0)::int AS receipt_read " +
      "FROM messages m JOIN profiles p ON p.user_id = m.sender_id " +
      "LEFT JOIN LATERAL (SELECT count(*)::int AS recipient_count, count(*) FILTER (WHERE mr.delivered_at IS NOT NULL)::int AS delivered_count, " +
      "count(*) FILTER (WHERE mr.read_at IS NOT NULL)::int AS read_count FROM message_receipts mr WHERE mr.message_id = m.id) receipts ON true " +
      "WHERE m.conversation_id = $1 ORDER BY m.created_at DESC LIMIT 300",
      [conversation.id],
    );
    return res.json({ messages: result.rows.reverse(), conversation });
  } catch (error) {
    console.error("[chat] Message list failed:", error.message);
    return sendError(res, 500, "MESSAGES_LIST_FAILED", "Не удалось загрузить сообщения.");
  }
});

app.post("/api/conversations/:conversationId/messages", requireAuth, async (req, res) => {
  const text = String(req.body?.text || "").trim();
  const replyToId = req.body?.replyToId || null;
  const messageType = String(req.body?.messageType || "text");
  if (!text || text.length > 10000 || !["text", "sticker", "system", "voice_room"].includes(messageType)) {
    return sendError(res, 400, "INVALID_MESSAGE", "Сообщение пустое или имеет недопустимый формат.");
  }
  const client = await pool.connect();
  let conversationId = null;
  try {
    await client.query("BEGIN");
    const membership = await client.query(
      "SELECT c.id FROM conversations c JOIN conversation_participants cp ON cp.conversation_id = c.id " +
      "WHERE c.id = $1 AND cp.user_id = $2 FOR UPDATE OF c, cp",
      [req.params.conversationId, req.authUser.id],
    );
    if (!membership.rowCount) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "CONVERSATION_NOT_FOUND", "Диалог не найден.");
    }
    conversationId = membership.rows[0].id;
    if (replyToId) {
      const reply = await client.query("SELECT id FROM messages WHERE id = $1 AND conversation_id = $2", [replyToId, conversationId]);
      if (!reply.rowCount) {
        await client.query("ROLLBACK");
        return sendError(res, 400, "INVALID_REPLY_TARGET", "Сообщение для ответа не найдено.");
      }
    }
    const blocked = await client.query(
      "SELECT 1 FROM blocked_users b JOIN conversation_participants cp ON cp.conversation_id = $1 AND cp.user_id = b.blocked_id " +
      "WHERE b.blocker_id = $2 LIMIT 1",
      [conversationId, req.authUser.id],
    );
    if (blocked.rowCount) {
      await client.query("ROLLBACK");
      return sendError(res, 403, "USER_BLOCKED", "Нельзя отправить сообщение этому пользователю.");
    }
    const result = await client.query(
      "INSERT INTO messages (conversation_id, sender_id, text, message_type, reply_to_id) VALUES ($1,$2,$3,$4,$5) " +
      "RETURNING id, conversation_id, sender_id, text, media_url, message_type, reply_to_id, created_at",
      [conversationId, req.authUser.id, text, messageType, replyToId],
    );
    await client.query(
      "INSERT INTO message_receipts (message_id, recipient_id) SELECT $1, user_id FROM conversation_participants WHERE conversation_id = $2 AND user_id <> $3 ON CONFLICT DO NOTHING",
      [result.rows[0].id, conversationId, req.authUser.id],
    );
    await client.query("UPDATE conversation_participants SET last_read_at = now() WHERE conversation_id = $1 AND user_id = $2", [conversationId, req.authUser.id]);
    await client.query("COMMIT");
    const message = { ...result.rows[0], sender_name: req.authUser.full_name };
    sendConversationEvent(conversationId, { type: "message:new", conversationId, message }, req.authUser.id);
    return res.status(201).json({ message });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[chat] Message send failed:", error.message);
    return sendError(res, 500, "MESSAGE_SEND_FAILED", "Не удалось отправить сообщение.");
  } finally {
    client.release();
  }
});

app.post("/api/conversations/:conversationId/delivered", requireAuth, async (req, res) => {
  const messageIds = Array.isArray(req.body?.messageIds) ? [...new Set(req.body.messageIds.map(String))].slice(0, 300) : [];
  if (!messageIds.length) return res.status(204).end();
  if (messageIds.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
    return sendError(res, 400, "INVALID_MESSAGE_IDS", "Некорректный список сообщений.");
  }
  try {
    const conversation = await requireConversationMember(req.params.conversationId, req.authUser.id);
    if (!conversation) return sendError(res, 404, "CONVERSATION_NOT_FOUND", "Диалог не найден.");
    const delivered = await pool.query(
      "UPDATE message_receipts mr SET delivered_at = COALESCE(mr.delivered_at, now()) " +
      "FROM messages m WHERE mr.message_id = m.id AND m.conversation_id = $1 AND m.id = ANY($2::uuid[]) " +
      "AND mr.recipient_id = $3 AND m.sender_id <> $3 AND mr.delivered_at IS NULL " +
      "RETURNING m.id, m.sender_id, mr.delivered_at",
      [conversation.id, messageIds, req.authUser.id],
    );
    const bySender = new Map();
    for (const row of delivered.rows) {
      if (!bySender.has(row.sender_id)) bySender.set(row.sender_id, []);
      bySender.get(row.sender_id).push(row.id);
    }
    for (const [senderId, ids] of bySender) {
      sendUserEvent(senderId, { type: "message:receipt", conversationId: conversation.id, recipientId: req.authUser.id, messageIds: ids, delivered: true });
    }
    return res.json({ deliveredCount: delivered.rowCount });
  } catch (error) {
    console.error("[chat] Message delivery receipt failed:", error.message);
    return sendError(res, 500, "MESSAGE_DELIVERY_FAILED", "Не удалось подтвердить доставку сообщений.");
  }
});

app.post("/api/conversations/:conversationId/read", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const member = await client.query(
      "UPDATE conversation_participants SET last_read_at = now() WHERE conversation_id = $1 AND user_id = $2 RETURNING conversation_id",
      [req.params.conversationId, req.authUser.id],
    );
    if (!member.rowCount) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "CONVERSATION_NOT_FOUND", "Диалог не найден.");
    }
    const read = await client.query(
      "UPDATE message_receipts mr SET delivered_at = COALESCE(mr.delivered_at, now()), read_at = COALESCE(mr.read_at, now()) " +
      "FROM messages m WHERE mr.message_id = m.id AND m.conversation_id = $1 AND mr.recipient_id = $2 AND m.sender_id <> $2 " +
      "AND mr.read_at IS NULL RETURNING m.id, m.sender_id",
      [req.params.conversationId, req.authUser.id],
    );
    await client.query("COMMIT");
    const bySender = new Map();
    for (const row of read.rows) {
      if (!bySender.has(row.sender_id)) bySender.set(row.sender_id, []);
      bySender.get(row.sender_id).push(row.id);
    }
    for (const [senderId, ids] of bySender) {
      sendUserEvent(senderId, { type: "message:receipt", conversationId: req.params.conversationId, recipientId: req.authUser.id, messageIds: ids, delivered: true, read: true });
    }
    return res.status(204).end();
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[chat] Read receipt update failed:", error.message);
    return sendError(res, 500, "READ_RECEIPT_FAILED", "Не удалось отметить сообщения прочитанными.");
  } finally {
    client.release();
  }
});

app.get("/api/jobs", requireAuth, async (req, res) => {
  const user = req.authUser;
  try {
    const result = await pool.query(
      "SELECT j.*, dp.full_name AS dispatcher_name FROM jobs j LEFT JOIN profiles dp ON dp.user_id = j.dispatcher_id " +
      "WHERE ($2 = 'admin') OR ($2 = 'client' AND j.client_id = $1) " +
      "OR ($2 = 'dispatcher' AND (j.dispatcher_id = $1 OR (j.dispatcher_id IS NULL AND j.status = 'open'))) " +
      "OR ($2 = 'worker' AND j.dispatcher_id IS NOT NULL AND j.status IN ('active','open')) " +
      "ORDER BY j.created_at DESC LIMIT 200",
      [user.id, user.role],
    );
    return res.json({ jobs: result.rows });
  } catch (error) {
    console.error("[jobs] List failed:", error.message);
    return sendError(res, 500, "JOBS_LIST_FAILED", "Не удалось загрузить заявки.");
  }
});

app.post("/api/jobs", requireAuth, async (req, res) => {
  const user = req.authUser;
  if (user.role !== "client" && user.role !== "admin") return sendError(res, 403, "CLIENT_ROLE_REQUIRED", "Создавать заявки может только заказчик.");
  const title = String(req.body?.title || "").trim();
  const description = String(req.body?.description || "").trim() || null;
  const hourlyRate = Number(req.body?.hourlyRate);
  const durationHours = Number(req.body?.durationHours);
  const workersNeeded = Number(req.body?.workersNeeded);
  const startTime = req.body?.startTime || null;
  const address = String(req.body?.address || "").trim() || null;
  const metro = String(req.body?.metro || "").trim() || null;
  if (title.length < 3 || title.length > 180 || !Number.isFinite(hourlyRate) || hourlyRate <= 0 ||
      !Number.isFinite(durationHours) || durationHours <= 0 || !Number.isInteger(workersNeeded) || workersNeeded < 1 || workersNeeded > 100) {
    return sendError(res, 400, "INVALID_JOB", "Проверьте название, ставку, длительность и количество исполнителей.");
  }
  if (startTime && Number.isNaN(Date.parse(startTime))) return sendError(res, 400, "INVALID_START_TIME", "Некорректная дата начала.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "INSERT INTO jobs (client_id, title, description, hourly_rate, start_time, duration_hours, address, metro, workers_needed, urgent, quick_minimum, requires_contract, status) " +
      "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'open') RETURNING *",
      [user.id, title, description, hourlyRate, startTime, durationHours, address, metro, workersNeeded,
        Boolean(req.body?.urgent), Boolean(req.body?.quickMinimum), Boolean(req.body?.requiresContract)],
    );
    await client.query(
      "INSERT INTO app_audit_log (actor_user_id, action, entity_type, entity_id, ip_address) VALUES ($1,'job.created','job',$2,$3)",
      [user.id, result.rows[0].id, req.ip],
    );
    await client.query("COMMIT");
    // Publish only committed state. A failed audit insert must never leave an untracked job.
    sendRoleEvent("worker", { type: "job:created", job: result.rows[0] });
    return res.status(201).json({ job: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[jobs] Create failed:", error.message);
    return sendError(res, 500, "JOB_CREATE_FAILED", "Не удалось создать заявку.");
  } finally {
    client.release();
  }
});

app.get("/api/jobs/:jobId/offers", requireAuth, async (req, res) => {
  const user = req.authUser;
  try {
    const job = await pool.query("SELECT id, client_id, dispatcher_id FROM jobs WHERE id = $1 LIMIT 1", [req.params.jobId]);
    if (!job.rowCount) return sendError(res, 404, "JOB_NOT_FOUND", "Заявка не найдена.");
    const row = job.rows[0];
    const allowed = user.role === "admin" ||
      (user.role === "client" && row.client_id === user.id) ||
      (user.role === "dispatcher" && !row.dispatcher_id);
    if (!allowed) return sendError(res, 403, "FORBIDDEN", "Нет доступа к предложениям по этой заявке.");
    const result = await pool.query(
      "SELECT o.id, o.job_id, o.dispatcher_id, o.proposed_hourly_rate, o.proposed_workers, o.message, o.status, o.created_at, o.updated_at, " +
      "p.full_name AS dispatcher_name, p.avatar_url AS dispatcher_avatar, p.rating AS dispatcher_rating, p.completed_orders AS dispatcher_completed_orders " +
      "FROM dispatcher_offers o JOIN profiles p ON p.user_id = o.dispatcher_id WHERE o.job_id = $1 " +
      "AND ($2 = 'admin' OR ($2 = 'client' AND $3 = $4) OR ($2 = 'dispatcher' AND o.dispatcher_id = $3)) ORDER BY o.created_at DESC",
      [req.params.jobId, user.role, user.id, row.client_id],
    );
    return res.json({ offers: result.rows });
  } catch (error) {
    console.error("[dispatcher-offers] List failed:", error.message);
    return sendError(res, 500, "DISPATCHER_OFFERS_LIST_FAILED", "Не удалось загрузить предложения диспетчеров.");
  }
});

app.post("/api/jobs/:jobId/offers", requireAuth, async (req, res) => {
  const user = req.authUser;
  if (user.role !== "dispatcher") return sendError(res, 403, "DISPATCHER_ROLE_REQUIRED", "Предложить сопровождение заявки может только диспетчер.");
  const rate = Number(req.body?.proposedHourlyRate);
  const workers = Number(req.body?.proposedWorkers);
  const message = String(req.body?.message || "").trim().slice(0, 1000) || null;
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isInteger(workers) || workers < 1 || workers > 100) {
    return sendError(res, 400, "INVALID_DISPATCHER_OFFER", "Укажите положительную ставку и количество исполнителей от 1 до 100.");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const jobResult = await client.query("SELECT id, client_id, dispatcher_id, status FROM jobs WHERE id = $1 FOR UPDATE", [req.params.jobId]);
    const job = jobResult.rows[0];
    if (!job) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "JOB_NOT_FOUND", "Заявка не найдена.");
    }
    if (!job.client_id || job.dispatcher_id || job.status !== "open") {
      await client.query("ROLLBACK");
      return sendError(res, 409, "JOB_NOT_AVAILABLE_FOR_OFFERS", "Заявка уже назначена или больше не принимает предложения.");
    }
    const result = await client.query(
      "INSERT INTO dispatcher_offers (job_id, dispatcher_id, proposed_hourly_rate, proposed_workers, message) " +
      "VALUES ($1,$2,$3,$4,$5) ON CONFLICT (job_id, dispatcher_id) DO UPDATE SET " +
      "proposed_hourly_rate = EXCLUDED.proposed_hourly_rate, proposed_workers = EXCLUDED.proposed_workers, " +
      "message = EXCLUDED.message, status = 'pending', updated_at = now() RETURNING *",
      [job.id, user.id, rate, workers, message],
    );
    const offer = result.rows[0];
    await client.query(
      "INSERT INTO app_audit_log (actor_user_id, action, entity_type, entity_id, ip_address, metadata) VALUES ($1,'dispatcher.offer_submitted','dispatcher_offer',$2,$3,$4::jsonb)",
      [user.id, offer.id, req.ip, JSON.stringify({ jobId: job.id, proposedHourlyRate: rate, proposedWorkers: workers })],
    );
    await client.query("COMMIT");
    sendUserEvent(job.client_id, { type: "dispatcher:offer_created", offer });
    return res.status(201).json({ offer });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[dispatcher-offers] Submit failed:", error.message);
    return sendError(res, error.code === "23505" ? 409 : 500,
      error.code === "23505" ? "OFFER_CONFLICT" : "DISPATCHER_OFFER_CREATE_FAILED",
      error.code === "23505" ? "Предложение уже существует." : "Не удалось отправить предложение диспетчера.");
  } finally {
    client.release();
  }
});

app.post("/api/dispatcher-offers/:offerId/select", requireAuth, async (req, res) => {
  const user = req.authUser;
  if (user.role !== "client") return sendError(res, 403, "CLIENT_ROLE_REQUIRED", "Выбрать диспетчера может только заказчик.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const jobLock = await client.query(
      "SELECT j.id FROM jobs j JOIN dispatcher_offers o ON o.job_id = j.id WHERE o.id = $1 FOR UPDATE OF j",
      [req.params.offerId],
    );
    if (!jobLock.rowCount) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "OFFER_NOT_FOUND", "Предложение диспетчера не найдено.");
    }
    const offerResult = await client.query(
      "SELECT o.*, j.client_id, j.dispatcher_id, j.status AS job_status FROM dispatcher_offers o JOIN jobs j ON j.id = o.job_id WHERE o.id = $1 FOR UPDATE OF o",
      [req.params.offerId],
    );
    const offer = offerResult.rows[0];
    if (!offer || offer.client_id !== user.id) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "OFFER_NOT_FOUND", "Предложение диспетчера не найдено.");
    }
    if (offer.status !== "pending" || offer.dispatcher_id || offer.job_status !== "open") {
      await client.query("ROLLBACK");
      return sendError(res, 409, "OFFER_NO_LONGER_AVAILABLE", "Это предложение уже нельзя выбрать.");
    }
    const updatedJob = await client.query(
      "UPDATE jobs SET dispatcher_id = $1, hourly_rate = $2, workers_needed = $3, status = 'active', updated_at = now() " +
      "WHERE id = $4 AND client_id = $5 AND dispatcher_id IS NULL AND status = 'open' RETURNING *",
      [offer.dispatcher_id, offer.proposed_hourly_rate, offer.proposed_workers, offer.job_id, user.id],
    );
    if (!updatedJob.rowCount) {
      await client.query("ROLLBACK");
      return sendError(res, 409, "JOB_ALREADY_ASSIGNED", "Заявка уже назначена другому диспетчеру.");
    }
    const changedOffers = await client.query(
      "UPDATE dispatcher_offers SET status = CASE WHEN id = $2 THEN 'accepted' ELSE 'rejected' END, updated_at = now() " +
      "WHERE job_id = $1 AND status = 'pending' RETURNING id, dispatcher_id, status",
      [offer.job_id, offer.id],
    );
    await client.query(
      "INSERT INTO app_audit_log (actor_user_id, action, entity_type, entity_id, ip_address, metadata) VALUES ($1,'client.dispatcher_selected','job',$2,$3,$4::jsonb)",
      [user.id, offer.job_id, req.ip, JSON.stringify({ offerId: offer.id, dispatcherId: offer.dispatcher_id })],
    );
    await client.query("COMMIT");
    for (const changed of changedOffers.rows) {
      sendUserEvent(changed.dispatcher_id, {
        type: changed.status === "accepted" ? "dispatcher:offer_accepted" : "dispatcher:offer_rejected",
        offerId: changed.id,
        jobId: offer.job_id,
      });
    }
    sendRoleEvent("worker", { type: "job:updated", job: updatedJob.rows[0] });
    return res.json({ job: updatedJob.rows[0], selectedOfferId: offer.id });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[dispatcher-offers] Selection failed:", error.message);
    return sendError(res, 500, "DISPATCHER_OFFER_SELECT_FAILED", "Не удалось выбрать диспетчера.");
  } finally {
    client.release();
  }
});

app.get("/api/jobs/:jobId", requireAuth, async (req, res) => {
  const user = req.authUser;
  try {
    const result = await pool.query("SELECT j.*, dp.full_name AS dispatcher_name FROM jobs j LEFT JOIN profiles dp ON dp.user_id = j.dispatcher_id WHERE j.id = $1 LIMIT 1", [req.params.jobId]);
    const job = result.rows[0];
    if (!job) return sendError(res, 404, "JOB_NOT_FOUND", "Заявка не найдена.");
    const allowed = user.role === "admin" || (user.role === "client" && job.client_id === user.id) ||
      (user.role === "dispatcher" && job.dispatcher_id === user.id) ||
      (user.role === "worker" && job.dispatcher_id && ["open", "active", "filled"].includes(job.status));
    if (!allowed) return sendError(res, 403, "FORBIDDEN", "Нет доступа к этой заявке.");
    return res.json({ job });
  } catch (error) {
    console.error("[jobs] Detail failed:", error.message);
    return sendError(res, 500, "JOB_LOOKUP_FAILED", "Не удалось загрузить заявку.");
  }
});

app.get("/api/jobs/:jobId/responses", requireAuth, async (req, res) => {
  const user = req.authUser;
  try {
    const job = await pool.query("SELECT * FROM jobs WHERE id = $1", [req.params.jobId]);
    if (!job.rowCount) return sendError(res, 404, "JOB_NOT_FOUND", "Заявка не найдена.");
    if (user.role !== "admin" && (user.role !== "dispatcher" || job.rows[0].dispatcher_id !== user.id)) {
      return sendError(res, 403, "FORBIDDEN", "Нет доступа к откликам этой заявки.");
    }
    const result = await pool.query(
      "SELECT r.*, p.full_name, p.avatar_url, p.rating, p.completed_orders, p.is_premium, p.verified, p.skills " +
      "FROM job_responses r LEFT JOIN profiles p ON p.user_id = r.worker_id WHERE r.job_id = $1 ORDER BY r.created_at DESC",
      [req.params.jobId],
    );
    return res.json({ responses: result.rows, job: job.rows[0] });
  } catch (error) {
    console.error("[jobs] Responses list failed:", error.message);
    return sendError(res, 500, "RESPONSES_LIST_FAILED", "Не удалось загрузить отклики.");
  }
});

app.get("/api/jobs/:jobId/my-response", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, status, worker_status FROM job_responses WHERE job_id = $1 AND worker_id = $2 LIMIT 1",
      [req.params.jobId, req.authUser.id],
    );
    return res.json({ response: result.rows[0] || null });
  } catch (error) {
    console.error("[jobs] Own response lookup failed:", error.message);
    return sendError(res, 500, "RESPONSE_LOOKUP_FAILED", "Не удалось проверить отклик.");
  }
});

app.post("/api/jobs/:jobId/responses", requireAuth, async (req, res) => {
  const user = req.authUser;
  if (user.role !== "worker") return sendError(res, 403, "WORKER_ROLE_REQUIRED", "Откликаться на заявки может только исполнитель.");

  try {
    const result = await submitWorkerResponse({
      db: pool,
      jobId: req.params.jobId,
      workerId: user.id,
      message: String(req.body?.message || "").trim().slice(0, 2000),
    });

    if (!result.existing) {
      sendUserEvent(result.dispatcherId, {
        type: "response:created",
        response: result.response,
        jobId: req.params.jobId,
      });
      if (result.notification) {
        sendUserEvent(result.dispatcherId, {
          type: "notification:new",
          notification: result.notification,
        });
      }
      if (result.message) {
        sendConversationEvent(result.conversationId, {
          type: "message:new",
          conversationId: result.conversationId,
          message: result.message,
        }, user.id);
      }
    }

    return res.status(result.existing ? 200 : 201).json({
      response: result.response,
      conversationId: result.conversationId,
      existing: result.existing,
      weeklyCompletedJobs: result.weeklyCompletedJobs,
    });
  } catch (error) {
    if (error instanceof WorkerResponseError) {
      return sendError(res, error.status, error.code, error.message);
    }
    if (error.code === "23505") {
      return sendError(res, 409, "RESPONSE_ALREADY_EXISTS", "Вы уже откликнулись на эту заявку.");
    }
    console.error("[jobs] Response workflow failed:", error.message);
    return sendError(res, 500, "RESPONSE_CREATE_FAILED", "Не удалось отправить отклик.");
  }
});

app.post("/api/responses/:responseId/worker-status", requireAuth, async (req, res) => {
  const user = req.authUser;
  if (user.role !== "worker") return sendError(res, 403, "WORKER_ROLE_REQUIRED", "Менять статус работы может только исполнитель.");
  const nextStatus = String(req.body?.nextStatus || "");
  if (!["confirmed", "en_route", "late", "arrived", "completed"].includes(nextStatus)) {
    return sendError(res, 400, "INVALID_WORKER_STATUS", "Недопустимый статус исполнителя.");
  }
  let hoursWorked = null;
  if (nextStatus === "completed") {
    try {
      hoursWorked = normalizeWorkedHours(req.body?.hoursWorked);
    } catch {
      return sendError(res, 400, "INVALID_WORKED_HOURS", "Укажите фактически отработанное время от 0,5 до 72 часов.");
    }
  }

  const client = await pool.connect();
  let dispatcherId = null;
  let response;
  try {
    await client.query("BEGIN");
    const jobLock = await client.query(
      "SELECT j.id FROM jobs j JOIN job_responses r ON r.job_id = j.id WHERE r.id = $1 FOR UPDATE OF j",
      [req.params.responseId],
    );
    if (!jobLock.rowCount) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "RESPONSE_NOT_FOUND", "Отклик не найден.");
    }
    const result = await client.query(
      "SELECT r.*, j.dispatcher_id, j.status AS job_status FROM job_responses r JOIN jobs j ON j.id = r.job_id WHERE r.id = $1 FOR UPDATE OF r",
      [req.params.responseId],
    );
    response = result.rows[0];
    if (!response || response.worker_id !== user.id) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "RESPONSE_NOT_FOUND", "Отклик не найден.");
    }
    if (response.status !== "accepted" || !["active", "filled", "finishing"].includes(response.job_status)) {
      await client.query("ROLLBACK");
      return sendError(res, 409, "RESPONSE_NOT_ACTIVE", "Этот заказ больше нельзя обновить.");
    }
    if (!isWorkerStatusTransitionAllowed(response.worker_status, nextStatus)) {
      await client.query("ROLLBACK");
      return sendError(res, 409, "INVALID_STATUS_TRANSITION", "Сначала выполните предыдущий шаг.");
    }
    dispatcherId = response.dispatcher_id;

    let updated;
    if (nextStatus === "arrived") {
      updated = await client.query(
        "UPDATE job_responses SET worker_status = 'arrived', work_started_at = COALESCE(work_started_at, now()) WHERE id = $1 " +
        "RETURNING id, job_id, worker_id, worker_status, work_started_at, work_finished_at, hours_worked, earned",
        [response.id],
      );
    } else if (nextStatus === "completed") {
      if (!response.work_started_at) {
        await client.query("ROLLBACK");
        return sendError(res, 409, "WORK_NOT_STARTED", "Нельзя завершить заказ до прибытия на объект.");
      }
      if (!Number(response.agreed_hourly_rate) || Number(response.agreed_hourly_rate) <= 0) {
        await client.query("ROLLBACK");
        return sendError(res, 409, "AGREED_RATE_MISSING", "Для заказа не зафиксирована согласованная ставка.");
      }
      const earned = calculateWorkerEarnings(hoursWorked, response.agreed_hourly_rate);
      updated = await client.query(
        "UPDATE job_responses SET worker_status = 'completed', work_finished_at = now(), hours_worked = $2, earned = $3 " +
        "WHERE id = $1 RETURNING id, job_id, worker_id, worker_status, work_started_at, work_finished_at, hours_worked, earned",
        [response.id, hoursWorked, earned],
      );
    } else {
      updated = await client.query(
        "UPDATE job_responses SET worker_status = $2 WHERE id = $1 " +
        "RETURNING id, job_id, worker_id, worker_status, work_started_at, work_finished_at, hours_worked, earned",
        [response.id, nextStatus],
      );
    }
    await client.query("COMMIT");
    const saved = updated.rows[0];
    sendUserEvent(user.id, { type: "response:updated", response: saved });
    if (dispatcherId) sendUserEvent(dispatcherId, { type: "response:updated", response: saved });
    return res.json({ response: saved });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[responses] Worker status update failed:", error.message);
    return sendError(res, 500, "WORKER_STATUS_UPDATE_FAILED", "Не удалось обновить статус исполнителя.");
  } finally {
    client.release();
  }
});

app.post("/api/responses/:responseId/accept", requireAuth, async (req, res) => {
  const user = req.authUser;
  if (user.role !== "dispatcher" && user.role !== "admin") return sendError(res, 403, "DISPATCHER_ROLE_REQUIRED", "Принимать отклики может только диспетчер.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize all staffing decisions on the job row first. Locking response+job
    // in one joined query can deadlock when two dispatchers accept different responses
    // and the winning transaction auto-rejects the other transaction's locked response.
    const jobLock = await client.query(
      "SELECT j.id FROM jobs j JOIN job_responses r ON r.job_id = j.id WHERE r.id = $1 FOR UPDATE OF j",
      [req.params.responseId],
    );
    if (!jobLock.rowCount) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "RESPONSE_NOT_FOUND", "Отклик не найден.");
    }
    const responseResult = await client.query(
      "SELECT r.*, j.dispatcher_id, j.workers_needed, j.hourly_rate, j.status AS job_status FROM job_responses r JOIN jobs j ON j.id = r.job_id WHERE r.id = $1 FOR UPDATE OF r",
      [req.params.responseId],
    );
    const response = responseResult.rows[0];
    if (!response || (user.role !== "admin" && response.dispatcher_id !== user.id)) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "RESPONSE_NOT_FOUND", "Отклик не найден.");
    }
    if (response.status !== "pending" || !["open", "active"].includes(response.job_status)) {
      await client.query("ROLLBACK");
      return sendError(res, 409, "RESPONSE_NOT_PENDING", "Этот отклик уже нельзя принять.");
    }
    const acceptedCount = await client.query("SELECT count(*)::int AS count FROM job_responses WHERE job_id = $1 AND status = 'accepted'", [response.job_id]);
    const needed = Math.max(1, Number(response.workers_needed || 1));
    if (acceptedCount.rows[0].count >= needed) {
      await client.query("ROLLBACK");
      return sendError(res, 409, "WORKERS_LIMIT_REACHED", "Лимит грузчиков уже достигнут.");
    }
    // Freeze the job's current rate at the exact moment the dispatcher accepts the worker.
    // Later edits to the job rate must not rewrite an already agreed worker rate.
    await client.query(
      "UPDATE job_responses SET status = 'accepted', agreed_hourly_rate = COALESCE(agreed_hourly_rate, $2), worker_status = COALESCE(worker_status, 'ready') WHERE id = $1",
      [response.id, response.hourly_rate],
    );
    const acceptedNow = acceptedCount.rows[0].count + 1;
    const filled = acceptedNow >= needed;
    let autoRejected = 0;
    if (filled) {
      await client.query("UPDATE jobs SET status = 'filled', updated_at = now() WHERE id = $1", [response.job_id]);
      const rejected = await client.query(
        "UPDATE job_responses SET status = 'rejected' WHERE job_id = $1 AND status = 'pending' AND id <> $2 RETURNING id, worker_id",
        [response.job_id, response.id],
      );
      autoRejected = rejected.rowCount || 0;
      for (const rejectedResponse of rejected.rows) {
        sendUserEvent(rejectedResponse.worker_id, {
          type: "response:updated",
          responseId: rejectedResponse.id,
          jobId: response.job_id,
          status: "rejected",
          reason: "workers_limit_reached",
        });
      }
    } else {
      await client.query("UPDATE jobs SET status = 'active', updated_at = now() WHERE id = $1 AND status = 'open'", [response.job_id]);
    }
    await client.query("COMMIT");
    sendUserEvent(response.worker_id, { type: "response:updated", responseId: response.id, jobId: response.job_id, status: "accepted", workerStatus: response.worker_status || "ready" });
    sendUserEvent(response.dispatcher_id, { type: "job:updated", jobId: response.job_id, status: filled ? "filled" : "active" });
    return res.json({ accepted_count: acceptedNow, workers_needed: needed, filled, auto_rejected: autoRejected });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[jobs] Accept response failed:", error.message);
    return sendError(res, 500, "RESPONSE_ACCEPT_FAILED", "Не удалось принять отклик.");
  } finally {
    client.release();
  }
});

app.post("/api/responses/:responseId/cancel-assignment", requireAuth, async (req, res) => {
  const user = req.authUser;
  if (user.role !== "dispatcher" && user.role !== "admin") return sendError(res, 403, "DISPATCHER_ROLE_REQUIRED", "Снять исполнителя с заказа может только диспетчер.");
  const client = await pool.connect();
  let workerId = null;
  let jobId = null;
  let clientId = null;
  let jobStatus = null;
  try {
    await client.query("BEGIN");
    const jobLock = await client.query(
      "SELECT j.id FROM jobs j JOIN job_responses r ON r.job_id = j.id WHERE r.id = $1 FOR UPDATE OF j",
      [req.params.responseId],
    );
    if (!jobLock.rowCount) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "RESPONSE_NOT_FOUND", "Отклик не найден.");
    }
    const result = await client.query(
      "SELECT r.id, r.job_id, r.worker_id, r.status AS response_status, r.work_started_at, j.dispatcher_id, j.client_id, j.workers_needed, j.status AS job_status " +
      "FROM job_responses r JOIN jobs j ON j.id = r.job_id WHERE r.id = $1 FOR UPDATE OF r",
      [req.params.responseId],
    );
    const response = result.rows[0];
    if (!response || (user.role !== "admin" && response.dispatcher_id !== user.id)) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "RESPONSE_NOT_FOUND", "Отклик не найден.");
    }
    if (response.response_status !== "accepted" || response.work_started_at ||
        !["active", "filled"].includes(response.job_status)) {
      await client.query("ROLLBACK");
      return sendError(res, 409, "ASSIGNMENT_NOT_CANCELLABLE", "Назначение нельзя отменить после начала работы или перевода заказа в завершение.");
    }
    workerId = response.worker_id;
    jobId = response.job_id;
    clientId = response.client_id;
    const updated = await client.query(
      "UPDATE job_responses SET status = 'rejected', worker_status = 'cancelled' WHERE id = $1 " +
      "RETURNING id, job_id, worker_id, status, worker_status",
      [response.id],
    );
    const acceptedCount = await client.query(
      "SELECT count(*)::int AS count FROM job_responses WHERE job_id = $1 AND status = 'accepted'",
      [jobId],
    );
    jobStatus = response.job_status;
    if (response.job_status === "filled" && acceptedCount.rows[0].count < Number(response.workers_needed || 1)) {
      await client.query("UPDATE jobs SET status = 'active', updated_at = now() WHERE id = $1", [jobId]);
      jobStatus = "active";
    }
    await client.query(
      "INSERT INTO app_audit_log (actor_user_id, action, entity_type, entity_id, ip_address) VALUES ($1,'dispatcher.assignment_cancelled','job_response',$2,$3)",
      [user.id, response.id, req.ip],
    );
    await client.query("COMMIT");
    sendUserEvent(workerId, { type: "response:cancelled", response: updated.rows[0], reason: "dispatcher_cancelled_before_start" });
    if (clientId) sendUserEvent(clientId, { type: "job:updated", jobId, status: jobStatus });
    sendRoleEvent("worker", { type: "job:updated", jobId, status: jobStatus });
    return res.json({ response: updated.rows[0], jobStatus });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[responses] Assignment cancellation failed:", error.message);
    return sendError(res, 500, "ASSIGNMENT_CANCEL_FAILED", "Не удалось снять исполнителя с заказа.");
  } finally {
    client.release();
  }
});

app.post("/api/jobs/:jobId/finish", requireAuth, async (req, res) => {
  const user = req.authUser;
  if (user.role !== "dispatcher" && user.role !== "admin") return sendError(res, 403, "DISPATCHER_ROLE_REQUIRED", "Завершить этап заказа может только диспетчер.");
  const client = await pool.connect();
  let workerEvents = [];
  let clientId = null;
  try {
    await client.query("BEGIN");
    const jobResult = await client.query("SELECT id, dispatcher_id, client_id, status FROM jobs WHERE id = $1 FOR UPDATE", [req.params.jobId]);
    const job = jobResult.rows[0];
    if (!job || (user.role !== "admin" && job.dispatcher_id !== user.id)) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "JOB_NOT_FOUND", "Заказ не найден.");
    }
    clientId = job.client_id;
    if (job.status === "finishing") {
      const pending = await client.query(
        "SELECT count(*)::int AS count FROM job_responses WHERE job_id = $1 AND status = 'accepted' AND worker_status <> 'completed'",
        [job.id],
      );
      await client.query("COMMIT");
      return res.json({ jobId: job.id, status: "finishing", workersNotCompleted: pending.rows[0].count });
    }
    if (!["active", "filled"].includes(job.status)) {
      await client.query("ROLLBACK");
      return sendError(res, 409, "JOB_NOT_FINISHABLE", "Заказ нельзя перевести в завершение из текущего статуса.");
    }
    const responses = await client.query(
      "SELECT id, worker_id, worker_status, work_started_at FROM job_responses WHERE job_id = $1 AND status = 'accepted' FOR UPDATE",
      [job.id],
    );
    if (!responses.rowCount) {
      await client.query("ROLLBACK");
      return sendError(res, 409, "NO_ASSIGNED_WORKERS", "В заказе нет принятых исполнителей.");
    }
    if (responses.rows.some((row) => !row.work_started_at)) {
      await client.query("ROLLBACK");
      return sendError(res, 409, "WORKERS_NOT_ARRIVED", "Нельзя завершить заказ: не все назначенные исполнители приступили к работе.");
    }
    const updated = await client.query(
      "UPDATE job_responses SET worker_status = 'finishing' WHERE job_id = $1 AND status = 'accepted' AND worker_status <> 'completed' " +
      "RETURNING id, worker_id",
      [job.id],
    );
    workerEvents = updated.rows;
    await client.query("UPDATE jobs SET status = 'finishing', updated_at = now() WHERE id = $1", [job.id]);
    await client.query(
      "INSERT INTO app_audit_log (actor_user_id, action, entity_type, entity_id, ip_address) VALUES ($1,'dispatcher.job_finishing','job',$2,$3)",
      [user.id, job.id, req.ip],
    );
    await client.query("COMMIT");
    for (const worker of workerEvents) {
      sendUserEvent(worker.worker_id, { type: "response:updated", responseId: worker.id, jobId: job.id, workerStatus: "finishing" });
    }
    if (clientId) sendUserEvent(clientId, { type: "job:updated", jobId: job.id, status: "finishing" });
    sendUserEvent(job.dispatcher_id, { type: "job:updated", jobId: job.id, status: "finishing" });
    return res.json({ jobId: job.id, status: "finishing", workersNotCompleted: workerEvents.length });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[jobs] Finish stage failed:", error.message);
    return sendError(res, 500, "JOB_FINISH_FAILED", "Не удалось перевести заказ в завершение.");
  } finally {
    client.release();
  }
});

app.post("/api/jobs/:jobId/complete", requireAuth, async (req, res) => {
  const user = req.authUser;
  if (user.role !== "dispatcher" && user.role !== "admin") return sendError(res, 403, "DISPATCHER_ROLE_REQUIRED", "Закрыть заказ может только диспетчер.");
  const expensePerWorker = Number(req.body?.expensePerWorker ?? 0);
  const dispatcherIncome = Number(req.body?.dispatcherIncome);
  if (!Number.isFinite(expensePerWorker) || expensePerWorker < 0 || !Number.isFinite(dispatcherIncome) || dispatcherIncome < 0) {
    return sendError(res, 400, "INVALID_SETTLEMENT_AMOUNT", "Проверьте сумму расходов и дохода.");
  }
  const client = await pool.connect();
  let workers = [];
  let clientId = null;
  try {
    await client.query("BEGIN");
    const jobResult = await client.query("SELECT id, dispatcher_id, client_id, status FROM jobs WHERE id = $1 FOR UPDATE", [req.params.jobId]);
    const job = jobResult.rows[0];
    if (!job || (user.role !== "admin" && job.dispatcher_id !== user.id)) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "JOB_NOT_FOUND", "Заказ не найден.");
    }
    clientId = job.client_id;
    if (job.status !== "finishing") {
      await client.query("ROLLBACK");
      return sendError(res, 409, "JOB_NOT_FINISHING", "Сначала переведите заказ в этап завершения.");
    }
    const responseResult = await client.query(
      "SELECT id, worker_id, worker_status, hours_worked, earned, agreed_hourly_rate, dispatcher_review_rating, earnings_settled_at " +
      "FROM job_responses WHERE job_id = $1 AND status = 'accepted' FOR UPDATE",
      [job.id],
    );
    workers = responseResult.rows;
    if (!workers.length) {
      await client.query("ROLLBACK");
      return sendError(res, 409, "NO_ASSIGNED_WORKERS", "В заказе нет принятых исполнителей.");
    }
    if (workers.some((worker) => worker.worker_status !== "completed" || !Number(worker.hours_worked) || worker.earned == null)) {
      await client.query("ROLLBACK");
      return sendError(res, 409, "WORKERS_NOT_COMPLETED", "Не все исполнители завершили работу и указали фактические часы.");
    }
    if (workers.some((worker) => worker.dispatcher_review_rating == null)) {
      await client.query("ROLLBACK");
      return sendError(res, 409, "WORKERS_NOT_REVIEWED", "Сначала оставьте отзывы всем исполнителям.");
    }
    if (workers.some((worker) => worker.earnings_settled_at)) {
      await client.query("ROLLBACK");
      return sendError(res, 409, "SETTLEMENT_ALREADY_EXISTS", "Финансовое закрытие по этому заказу уже выполнялось.");
    }

    const ledger = await client.query(
      "WITH inserted AS (" +
      " INSERT INTO financial_ledger (user_id, job_id, response_id, entry_type, amount, metadata) " +
      " SELECT r.worker_id, r.job_id, r.id, 'worker_earning', r.earned, " +
      " jsonb_build_object('hoursWorked', r.hours_worked, 'agreedHourlyRate', r.agreed_hourly_rate) " +
      " FROM job_responses r WHERE r.job_id = $1 AND r.status = 'accepted' " +
      " ON CONFLICT DO NOTHING RETURNING user_id, amount" +
      "), totals AS (" +
      " SELECT user_id, sum(amount) AS amount, count(*)::int AS orders FROM inserted GROUP BY user_id" +
      ") " +
      "UPDATE profiles p SET total_earned = p.total_earned + totals.amount, completed_orders = p.completed_orders + totals.orders " +
      "FROM totals WHERE p.user_id = totals.user_id RETURNING p.user_id",
      [job.id],
    );
    const workerPayoutTotal = workers.reduce((sum, worker) => sum + Number(worker.earned || 0), 0);
    if (dispatcherIncome > 0) {
      await client.query(
        "INSERT INTO financial_ledger (user_id, job_id, entry_type, amount, metadata) VALUES ($1,$2,'dispatcher_income',$3,$4::jsonb)",
        [job.dispatcher_id, job.id, dispatcherIncome, JSON.stringify({ workerPayoutTotal })],
      );
    }
    await client.query("UPDATE job_responses SET earnings_settled_at = now() WHERE job_id = $1 AND status = 'accepted'", [job.id]);
    await client.query(
      "UPDATE jobs SET status = 'completed', expense_per_worker = $2, dispatcher_income = $3, updated_at = now() WHERE id = $1",
      [job.id, expensePerWorker, dispatcherIncome],
    );
    await client.query(
      "INSERT INTO app_audit_log (actor_user_id, action, entity_type, entity_id, ip_address, metadata) VALUES ($1,'dispatcher.job_settled','job',$2,$3,$4::jsonb)",
      [user.id, job.id, req.ip, JSON.stringify({ workerPayoutTotal, dispatcherIncome, expensePerWorker, workersSettled: ledger.rowCount })],
    );
    await client.query("COMMIT");
    for (const worker of workers) {
      sendUserEvent(worker.worker_id, { type: "response:settled", jobId: job.id, responseId: worker.id, earned: Number(worker.earned) });
    }
    if (clientId) sendUserEvent(clientId, { type: "job:updated", jobId: job.id, status: "completed" });
    sendUserEvent(job.dispatcher_id, { type: "job:updated", jobId: job.id, status: "completed" });
    return res.json({ jobId: job.id, status: "completed", workerPayoutTotal, dispatcherIncome, workersSettled: ledger.rowCount });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[jobs] Financial settlement failed:", error.message);
    return sendError(res, 500, "JOB_SETTLEMENT_FAILED", "Не удалось выполнить финансовое закрытие заказа.");
  } finally {
    client.release();
  }
});

app.post("/api/responses/:responseId/review", requireAuth, async (req, res) => {
  const user = req.authUser;
  if (user.role !== "dispatcher" && user.role !== "admin") return sendError(res, 403, "DISPATCHER_ROLE_REQUIRED", "Оценивать исполнителя может только диспетчер.");
  const rating = Number(req.body?.rating);
  const reviewText = String(req.body?.text || "").trim().slice(0, 2000) || null;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return sendError(res, 400, "INVALID_RATING", "Оценка должна быть от 1 до 5.");
  const client = await pool.connect();
  let workerId = null;
  try {
    await client.query("BEGIN");
    const jobLock = await client.query(
      "SELECT j.id FROM jobs j JOIN job_responses r ON r.job_id = j.id WHERE r.id = $1 FOR UPDATE OF j",
      [req.params.responseId],
    );
    if (!jobLock.rowCount) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "RESPONSE_NOT_FOUND", "Отклик не найден.");
    }
    const result = await client.query(
      "SELECT r.id, r.job_id, r.worker_id, r.worker_status, j.dispatcher_id FROM job_responses r JOIN jobs j ON j.id = r.job_id WHERE r.id = $1 FOR UPDATE OF r",
      [req.params.responseId],
    );
    const response = result.rows[0];
    if (!response || (user.role !== "admin" && response.dispatcher_id !== user.id)) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "RESPONSE_NOT_FOUND", "Отклик не найден.");
    }
    if (response.worker_status !== "completed") {
      await client.query("ROLLBACK");
      return sendError(res, 409, "WORKER_NOT_COMPLETED", "Оценить можно только завершившего работу исполнителя.");
    }
    workerId = response.worker_id;
    await client.query(
      "UPDATE job_responses SET dispatcher_review_rating = $2, dispatcher_review_text = $3 WHERE id = $1",
      [response.id, rating, reviewText],
    );
    await client.query(
      "UPDATE profiles SET rating = COALESCE((SELECT round(avg(dispatcher_review_rating)::numeric, 2) FROM job_responses WHERE worker_id = $1 AND dispatcher_review_rating IS NOT NULL), 0) WHERE user_id = $1",
      [workerId],
    );
    await client.query(
      "INSERT INTO app_audit_log (actor_user_id, action, entity_type, entity_id, ip_address, metadata) VALUES ($1,'dispatcher.worker_reviewed','job_response',$2,$3,$4::jsonb)",
      [user.id, response.id, req.ip, JSON.stringify({ rating })],
    );
    await client.query("COMMIT");
    sendUserEvent(workerId, { type: "response:reviewed", responseId: response.id, jobId: response.job_id, rating });
    return res.json({ responseId: response.id, rating });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[responses] Worker review failed:", error.message);
    return sendError(res, 500, "WORKER_REVIEW_FAILED", "Не удалось сохранить отзыв.");
  } finally {
    client.release();
  }
});

app.post("/api/responses/:responseId/reject", requireAuth, async (req, res) => {
  const user = req.authUser;
  if (user.role !== "dispatcher" && user.role !== "admin") return sendError(res, 403, "DISPATCHER_ROLE_REQUIRED", "Отклонять отклики может только диспетчер.");
  try {
    const result = await pool.query(
      "UPDATE job_responses r SET status = 'rejected' FROM jobs j WHERE r.id = $1 AND j.id = r.job_id AND r.status = 'pending' AND ($2 = 'admin' OR j.dispatcher_id = $3) RETURNING r.id, r.worker_id, r.job_id",
      [req.params.responseId, user.role, user.id],
    );
    if (!result.rowCount) return sendError(res, 409, "RESPONSE_NOT_REJECTABLE", "Этот отклик уже нельзя отклонить.");
    const response = result.rows[0];
    sendUserEvent(response.worker_id, { type: "response:updated", responseId: response.id, jobId: response.job_id, status: "rejected" });
    return res.json({ success: true });
  } catch (error) {
    console.error("[jobs] Reject response failed:", error.message);
    return sendError(res, 500, "RESPONSE_REJECT_FAILED", "Не удалось отклонить отклик.");
  }
});

app.post("/api/responses/:responseId/withdraw", requireAuth, async (req, res) => {
  const user = req.authUser;
  if (user.role !== "worker") return sendError(res, 403, "WORKER_ROLE_REQUIRED", "Только исполнитель может отозвать отклик.");
  try {
    const result = await pool.query(
      "UPDATE job_responses r SET status = 'withdrawn' FROM jobs j " +
      "WHERE r.id = $1 AND r.worker_id = $2 AND r.status = 'pending' AND j.id = r.job_id " +
      "RETURNING r.id, r.job_id, j.dispatcher_id",
      [req.params.responseId, user.id],
    );
    if (!result.rowCount) return sendError(res, 409, "RESPONSE_NOT_WITHDRAWABLE", "Этот отклик уже нельзя отозвать.");
    const response = result.rows[0];
    if (response.dispatcher_id) sendUserEvent(response.dispatcher_id, { type: "response:withdrawn", responseId: response.id, jobId: response.job_id });
    return res.json({ success: true });
  } catch (error) {
    console.error("[jobs] Withdraw response failed:", error.message);
    return sendError(res, 500, "RESPONSE_WITHDRAW_FAILED", "Не удалось отозвать отклик.");
  }
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
  await mkdir(uploadDir, { recursive: true, mode: 0o700 });
  if (pool) {
    try {
      await migrateDatabase();
      await pool.query("SELECT 1");
      // A process restart invalidates all in-memory WebSocket sessions.
      // Clear persisted online flags so stale sessions never appear online.
      await pool.query("UPDATE profiles SET is_online = false, updated_at = now() WHERE is_online = true");
      databaseReady = true;
      console.info("[db] PostgreSQL connected and schema is ready.");
      try {
        stopNotificationListener = await startNotificationListener(pool, ({ recipientId, notification, unreadCount }) => {
          sendUserEvent(recipientId, { type: "notifications:new", notification, unreadCount });
        });
      } catch (error) {
        console.error("[notifications] Realtime listener unavailable:", error.message);
      }
    } catch (error) {
      databaseReady = false;
      console.error("[db] Startup database check failed:", error.message);
    }
  } else {
    console.warn("[db] DATABASE_URL/PGHOST is not configured. API starts in limited mode.");
  }

  const server = createServer(app);
  server.on("upgrade", async (request, socket, head) => {
    try {
      const origin = request.headers.origin;
      const host = request.headers.host;
      if (!origin || !host || new URL(origin).host !== host || (process.env.NODE_ENV === "production" && !origin.startsWith("https://"))) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
      if (new URL(request.url || "/", "http://localhost").pathname !== "/api/realtime") {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }
      const authUser = await loadSession(request);
      if (!authUser || !databaseReady) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      realtime.handleUpgrade(request, socket, head, (ws) => {
        ws.userId = authUser.id;
        ws.userRole = authUser.role;
        ws.profileName = authUser.full_name || "Пользователь";
        socketConversations.set(ws, new Set());
        const isFirstConnection = !userSockets.has(ws.userId);
        if (isFirstConnection) userSockets.set(ws.userId, new Set());
        userSockets.get(ws.userId).add(ws);
        if (isFirstConnection) void publishPresence(ws.userId, true);
        sendSocket(ws, { type: "realtime:ready", userId: ws.userId });
        realtime.emit("connection", ws, request);
      });
    } catch {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
    }
  });
  realtime.on("connection", (ws) => {
    ws.on("message", async (raw) => {
      let payload;
      try { payload = JSON.parse(raw.toString()); } catch { return sendSocket(ws, { type: "error", code: "INVALID_JSON" }); }
      if (!payload || typeof payload !== "object") return;
      if (payload.type === "conversation:subscribe") {
        const conversationId = String(payload.conversationId || "");
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conversationId)) return;
        try {
          const member = await requireConversationMember(conversationId, ws.userId);
          if (!member) return sendSocket(ws, { type: "error", code: "FORBIDDEN_CONVERSATION" });
          socketConversations.get(ws)?.add(conversationId);
          return sendSocket(ws, { type: "conversation:subscribed", conversationId });
        } catch { return sendSocket(ws, { type: "error", code: "SUBSCRIBE_FAILED" }); }
      }
      if (payload.type === "call:signal") {
        const conversationId = String(payload.conversationId || "");
        const targetUserId = String(payload.toUserId || "");
        const signal = payload.signal;
        if (!signal || typeof signal !== "object" || !["ringing", "accept", "reject", "hangup", "offer", "answer", "ice"].includes(signal.kind)) {
          return sendSocket(ws, { type: "error", code: "INVALID_CALL_SIGNAL" });
        }
        try {
          const membership = await pool.query(
            "SELECT user_id FROM conversation_participants WHERE conversation_id = $1 AND user_id IN ($2,$3)",
            [conversationId, ws.userId, targetUserId],
          );
          if (membership.rowCount !== 2) {
            return sendSocket(ws, { type: "error", code: "CALL_NOT_ALLOWED" });
          }
          sendUserEvent(targetUserId, { type: "call:signal", conversationId, fromUserId: ws.userId, signal });
        } catch { sendSocket(ws, { type: "error", code: "CALL_SIGNAL_FAILED" }); }
        return;
      }
      if (payload.type === "call:ring") {
        const conversationId = String(payload.conversationId || "");
        const targetUserId = String(payload.toUserId || "");
        const mode = payload.mode === "video" ? "video" : "audio";
        try {
          const membership = await pool.query(
            "SELECT cp.user_id, p.full_name FROM conversation_participants cp JOIN profiles p ON p.user_id = cp.user_id WHERE cp.conversation_id = $1 AND cp.user_id IN ($2,$3)",
            [conversationId, ws.userId, targetUserId],
          );
          if (membership.rowCount !== 2) {
            return sendSocket(ws, { type: "error", code: "CALL_NOT_ALLOWED" });
          }
          const recipient = membership.rows.find((row) => row.user_id === targetUserId);
          const caller = membership.rows.find((row) => row.user_id === ws.userId);
          if (!recipient || !caller) return;
          sendUserEvent(targetUserId, { type: "call:ring", conversationId, fromUserId: ws.userId, fromName: caller.full_name || ws.profileName, mode });
          sendSocket(ws, { type: "call:ring:sent", conversationId });
        } catch { sendSocket(ws, { type: "error", code: "CALL_SIGNAL_FAILED" }); }
      }
    });
    ws.on("close", () => {
      const sockets = userSockets.get(ws.userId);
      sockets?.delete(ws);
      if (sockets?.size === 0) {
        userSockets.delete(ws.userId);
        void publishPresence(ws.userId, false);
      }
      socketConversations.delete(ws);
    });
  });
  server.listen(PORT, "0.0.0.0", () => {
    console.info("[http] GRUZLI listening on 0.0.0.0:" + PORT);
  });
  const shutdown = async (signal) => {
    console.info("[http] " + signal + " received; shutting down.");
    server.close(async () => {
      await stopNotificationListener().catch(() => {});
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

// CI validates migration branches against the Amvera backend workflow.

// PostgreSQL migration CI: schema application is part of the validation pipeline.
