import type { Database } from "./types";
import { DEMO_DISPATCHER_NAMES, DEMO_FEED_JOBS, DEMO_USERS, DEMO_WORKER_PROFILE } from "@/data/demoData";

type DemoUser = {
  id: string;
  email: string;
  phone?: string | null;
  user_metadata: Record<string, any>;
};

type DemoSession = { user: DemoUser; access_token: string };

type Row = Record<string, any>;

const DB_KEY = "gruzli_demo_db_v2";
const SESSION_KEY = "gruzli_demo_session_v1";

const DEMO_DISPATCHER_PROFILES = Object.entries(DEMO_DISPATCHER_NAMES).map(([user_id, full_name]) => ({
  user_id,
  full_name,
  phone: null,
  role: "dispatcher",
  rating: 4.9,
  completed_orders: 150,
}));

const seed: Record<string, Row[]> = {
  jobs: DEMO_FEED_JOBS.map((job) => ({ ...job })),
  profiles: [
    {
      user_id: DEMO_USERS.worker.id,
      full_name: DEMO_USERS.worker.name,
      phone: "+7 900 000-00-01",
      role: "worker",
      rating: DEMO_WORKER_PROFILE.rating,
      completed_orders: DEMO_WORKER_PROFILE.completed_orders,
      total_earned: DEMO_WORKER_PROFILE.total_earned,
      balance: DEMO_WORKER_PROFILE.balance,
      is_premium: DEMO_WORKER_PROFILE.is_premium,
      premium_until: DEMO_WORKER_PROFILE.premium_until,
      skills: DEMO_WORKER_PROFILE.skills,
    },
    { user_id: DEMO_USERS.dispatcher.id, full_name: DEMO_USERS.dispatcher.name, phone: "+7 900 000-00-02", role: "dispatcher", rating: 4.9, completed_orders: 342 },
    { user_id: DEMO_USERS.client.id, full_name: DEMO_USERS.client.name, phone: "+7 900 000-00-03", role: "client" },
    ...DEMO_DISPATCHER_PROFILES,
  ],
  profiles_public: [
    { user_id: DEMO_USERS.worker.id, full_name: DEMO_USERS.worker.name, avatar_url: null, rating: DEMO_WORKER_PROFILE.rating, completed_orders: DEMO_WORKER_PROFILE.completed_orders, verified: true },
    { user_id: DEMO_USERS.dispatcher.id, full_name: DEMO_USERS.dispatcher.name, avatar_url: null, rating: 4.9, completed_orders: 342, verified: true },
    ...DEMO_DISPATCHER_PROFILES.map(({ user_id, full_name, rating, completed_orders }) => ({
      user_id, full_name, avatar_url: null, rating, completed_orders, verified: true,
    })),
  ],
  dispatcher_offers: [
    { id: "demo-offer-1", job_id: "demo-job-1", dispatcher_id: DEMO_USERS.dispatcher.id, proposed_hourly_rate: 900, proposed_workers: 2, message: "Готов закрыть заказ командой из двух грузчиков.", status: "pending", created_at: new Date().toISOString() },
  ],
  job_responses: [],
  conversations: [],
  conversation_participants: [],
  messages: [],
  user_roles: [
    { id: "demo-role-1", user_id: DEMO_USERS.worker.id, role: "worker" },
    { id: "demo-role-2", user_id: DEMO_USERS.dispatcher.id, role: "dispatcher" },
    { id: "demo-role-3", user_id: DEMO_USERS.client.id, role: "client" },
  ],
  blocked_users: [],
  channel_posts: [],
  channel_post_likes: [],
  channel_post_comments: [],
  app_settings: [],
  kartoteka: [],
  job_contracts: [],
  job_documents: [],
  contract_signatures: [],
  dispatcher_reviews: [],
};

function loadDb(): Record<string, Row[]> {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const copy = JSON.parse(JSON.stringify(seed));
  localStorage.setItem(DB_KEY, JSON.stringify(copy));
  return copy;
}

function saveDb(db: Record<string, Row[]>) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function uid(prefix = "demo") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const DEMO_USER_BY_ROLE: Record<string, { id: string; name: string }> = {
  worker: { id: "demo-worker", name: "Алексей Морозов" },
  dispatcher: { id: "demo-dispatcher", name: "Анна Петрова" },
  client: { id: "demo-client", name: "Сергей Волков" },
};

function currentSession(): DemoSession | null {
  if (localStorage.getItem("gruzli_demo_worker") === "1") {
    const savedRole = localStorage.getItem("gruzli_demo_role");
    const role = savedRole === "dispatcher" || savedRole === "client" ? savedRole : "worker";
    const demo = DEMO_USER_BY_ROLE[role];
    return {
      user: {
        id: demo.id,
        email: `demo-${role}@gruzli.local`,
        user_metadata: { role, full_name: demo.name },
      },
      access_token: "demo-token",
    };
  }

  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

const authListeners = new Set<(event: string, session: DemoSession | null) => void>();

function emitAuth(event: string, session: DemoSession | null) {
  authListeners.forEach((listener) => listener(event, session));
}

class QueryBuilder implements PromiseLike<{ data: any; error: any; count?: number | null }> {
  private table: string;
  private rows: Row[];
  private filters: Array<(row: Row) => boolean> = [];
  private sort: { column: string; ascending: boolean } | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private singleMode: "single" | "maybeSingle" | null = null;
  private operation: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private selected = "*";
  private head = false;
  private wantCount = false;

  constructor(table: string) {
    this.table = table;
    const db = loadDb();
    this.rows = db[table] || [];
  }

  select(columns = "*", options?: { count?: "exact"; head?: boolean }) {
    this.selected = columns;
    if (this.operation === "select") this.operation = "select";
    this.wantCount = options?.count === "exact";
    this.head = options?.head === true;
    return this;
  }

  eq(column: string, value: any) { this.filters.push((r) => r[column] === value); return this; }
  neq(column: string, value: any) { this.filters.push((r) => r[column] !== value); return this; }
  in(column: string, values: any[]) { this.filters.push((r) => values.includes(r[column])); return this; }
  not(column: string, operator: string, value: any) { if (operator === "is") this.filters.push((r) => r[column] !== value); return this; }
  is(column: string, value: any) { this.filters.push((r) => r[column] === value); return this; }
  gte(column: string, value: any) { this.filters.push((r) => r[column] >= value); return this; }
  gt(column: string, value: any) { this.filters.push((r) => r[column] > value); return this; }
  lte(column: string, value: any) { this.filters.push((r) => r[column] <= value); return this; }
  lt(column: string, value: any) { this.filters.push((r) => r[column] < value); return this; }
  ilike(column: string, value: string) {
    const needle = value.replace(/%/g, "").toLowerCase();
    this.filters.push((r) => String(r[column] ?? "").toLowerCase().includes(needle));
    return this;
  }
  or(expression: string) {
    const parts = expression.split(",");
    this.filters.push((r) => parts.some((part) => {
      const m = part.match(/([^.]*)\.ilike\.(.*)/);
      return m ? String(r[m[1]] ?? "").toLowerCase().includes(m[2].replace(/%/g, "").toLowerCase()) : true;
    }));
    return this;
  }
  order(column: string, options?: { ascending?: boolean }) { this.sort = { column, ascending: options?.ascending !== false }; return this; }
  limit(n: number) { this.rangeFrom = 0; this.rangeTo = Math.max(0, n - 1); return this; }
  range(from: number, to: number) { this.rangeFrom = from; this.rangeTo = to; return this; }
  single() { this.singleMode = "single"; return this; }
  maybeSingle() { this.singleMode = "maybeSingle"; return this; }

  insert(payload: Row | Row[]) { this.operation = "insert"; this.payload = payload; return this; }
  update(payload: Row) { this.operation = "update"; this.payload = payload; return this; }
  upsert(payload: Row | Row[]) { this.operation = "upsert"; this.payload = payload; return this; }
  delete() { this.operation = "delete"; return this; }

  then<TResult1 = { data: any; error: any; count?: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled as any, onrejected as any);
  }

  private async execute() {
    const db = loadDb();
    if (!db[this.table]) db[this.table] = [];

    if (this.operation === "insert" || this.operation === "upsert") {
      const incoming = (Array.isArray(this.payload) ? this.payload : [this.payload]).filter(Boolean).map((row) => ({
        id: row!.id ?? uid(this.table),
        created_at: row!.created_at ?? new Date().toISOString(),
        ...row,
      }));

      if (this.operation === "insert" && this.table === "job_responses") {
        const session = currentSession();
        if (!session?.user) return { data: null, error: { code: "42501", message: "Не авторизован" } };
        for (const item of incoming) {
          const job = db.jobs.find((j) => j.id === item.job_id);
          if (item.worker_id !== session.user.id) return { data: null, error: { code: "42501", message: "Нельзя отправлять отклик от имени другого пользователя" } };
          if (!job || !["active", "open"].includes(job.status) || job.status === "filled" || job.status === "completed") {
            return { data: null, error: { code: "P0001", message: "Заказ уже недоступен" } };
          }
          item.status = item.status || "pending";
          item.worker_status = item.worker_status || null;
        }
        const duplicate = incoming.find((item) => db[this.table].some((existing) =>
          existing.job_id === item.job_id && existing.worker_id === item.worker_id && existing.status !== "withdrawn" && existing.status !== "rejected"
        ));
        if (duplicate) return { data: null, error: { code: "23505", message: "Вы уже откликнулись на этот заказ" } };
      }

      if (this.operation === "insert" && this.table === "dispatcher_offers") {
        const duplicate = incoming.find((item) => db[this.table].some((existing) =>
          existing.job_id === item.job_id && existing.dispatcher_id === item.dispatcher_id && existing.status === "pending"
        ));
        if (duplicate) return { data: null, error: { code: "23505", message: "Предложение по этому заказу уже отправлено" } };
      }
      if (this.operation === "upsert") {
        for (const item of incoming) {
          const index = db[this.table].findIndex((r) => item.id && r.id === item.id);
          if (index >= 0) db[this.table][index] = { ...db[this.table][index], ...item };
          else db[this.table].push(item);
        }
      } else db[this.table].push(...incoming);
      saveDb(db);
      return { data: incoming.length === 1 ? incoming[0] : incoming, error: null };
    }

    if (this.operation === "update") {
      const changed = db[this.table].filter((r) => this.filters.every((f) => f(r)));
      changed.forEach((r) => Object.assign(r, this.payload || {}));
      saveDb(db);
      return { data: changed, error: null };
    }

    if (this.operation === "delete") {
      const before = db[this.table].length;
      db[this.table] = db[this.table].filter((r) => !this.filters.every((f) => f(r)));
      saveDb(db);
      return { data: null, error: null, count: before - db[this.table].length };
    }

    let result = db[this.table].filter((r) => this.filters.every((f) => f(r)));
    const count = result.length;
    if (this.sort) result = [...result].sort((a,b) => {
      const av = a[this.sort!.column]; const bv = b[this.sort!.column];
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return this.sort!.ascending ? cmp : -cmp;
    });
    if (this.rangeFrom !== null) result = result.slice(this.rangeFrom, (this.rangeTo ?? result.length - 1) + 1);
    if (this.singleMode === "single") return { data: result[0] ?? null, error: result[0] ? null : { message: "No rows found", code: "PGRST116" }, count };
    if (this.singleMode === "maybeSingle") return { data: result[0] ?? null, error: null, count };
    return { data: this.head ? null : result, error: null, count: this.wantCount ? count : null };
  }
}

function profileFor(user: DemoUser | null) {
  if (!user) return null;
  const db = loadDb();
  return db.profiles?.find((p) => p.user_id === user.id) || {
    user_id: user.id,
    full_name: user.user_metadata?.full_name || "Пользователь Gruzli",
    role: user.user_metadata?.role || "worker",
    rating: 5,
    completed_orders: 0,
    total_earned: 0,
    balance: 0,
    is_premium: true,
    skills: [],
  };
}

async function rpc(name: string, args: Record<string, any> = {}) {
  const db = loadDb();
  const session = currentSession();
  const user = session?.user || null;

  if (name === "get_user_role") return { data: user?.user_metadata?.role || profileFor(user)?.role || "worker", error: null };
  if (name === "has_role") return { data: args._role === (user?.user_metadata?.role || profileFor(user)?.role), error: null };
  if (name === "is_admin") return { data: (user?.user_metadata?.role || profileFor(user)?.role) === "admin", error: null };
  if (name === "get_weekly_completed_jobs") return { data: 0, error: null };
  if (name === "get_unread_message_count") return { data: 0, error: null };
  if (name === "get_support_user_id") return { data: "demo-support", error: null };
  if (name === "client_create_job") {
    if (!user) return { data: null, error: { code: "42501", message: "Не авторизован" } };
    const title = String(args._title || "").trim();
    const address = String(args._address || "").trim();
    const rate = Number(args._hourly_rate);
    const duration = Number(args._duration_hours);
    const workers = Number(args._workers_needed);
    if (!title || !address || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(duration) || duration <= 0 || !Number.isInteger(workers) || workers < 1 || workers > 100) {
      return { data: null, error: { code: "22023", message: "Проверьте название, адрес, ставку, длительность и количество грузчиков" } };
    }
    const job = { id: uid("job"), title, description: String(args._description || "").trim(), address, metro: args._metro || null, duration_hours: duration, hourly_rate: rate, workers_needed: workers, start_time: args._start_time || null, status: "open", client_id: user.id, dispatcher_id: null, created_at: new Date().toISOString() };
    db.jobs.push(job); saveDb(db); return { data: job, error: null };
  }
  if (name === "dispatcher_submit_offer") {
    if (!user) return { data: null, error: { code: "42501", message: "Не авторизован" } };
    const job = db.jobs.find((j) => j.id === args._job_id);
    if (!job || job.status !== "open" || job.dispatcher_id) return { data: null, error: { code: "P0001", message: "Заказ уже недоступен" } };
    const rate = Number(args._proposed_hourly_rate);
    const workers = Number(args._proposed_workers);
    if (!Number.isFinite(rate) || rate <= 0 || !Number.isInteger(workers) || workers < 1 || workers > 100) {
      return { data: null, error: { code: "22023", message: "Проверьте ставку и количество грузчиков" } };
    }
    const duplicate = db.dispatcher_offers.find((o) => o.job_id === args._job_id && o.dispatcher_id === user.id && o.status === "pending");
    if (duplicate) return { data: null, error: { code: "23505", message: "Предложение уже отправлено" } };
    const offer = { id: uid("offer"), job_id: args._job_id, dispatcher_id: user.id, proposed_hourly_rate: rate, proposed_workers: workers, message: String(args._message || "").trim(), status: "pending", created_at: new Date().toISOString() };
    db.dispatcher_offers.push(offer); saveDb(db); return { data: offer, error: null };
  }
  if (name === "client_select_dispatcher_offer") {
    if (!user) return { data: null, error: { code: "42501", message: "Не авторизован" } };
    const offer = db.dispatcher_offers.find((o) => o.id === args._offer_id && o.status === "pending");
    if (!offer) return { data: null, error: { code: "P0002", message: "Предложение уже недоступно" } };
    const job = db.jobs.find((j) => j.id === offer.job_id);
    if (!job || job.client_id !== user.id) return { data: null, error: { code: "42501", message: "Нет доступа к заказу" } };
    if (job.status !== "open" || job.dispatcher_id) return { data: null, error: { code: "P0001", message: "К заказу уже назначен диспетчер" } };
    job.dispatcher_id = offer.dispatcher_id; job.status = "active";
    job.hourly_rate = offer.proposed_hourly_rate; job.workers_needed = offer.proposed_workers;
    db.dispatcher_offers.filter((o) => o.job_id === offer.job_id).forEach((o) => { o.status = o.id === offer.id ? "accepted" : "rejected"; });
    saveDb(db); return { data: job, error: null };
  }
  if (name === "worker_submit_response") {
    if (!user) return { data: null, error: { code: "42501", message: "Не авторизован" } };
    if ((user.user_metadata?.role || profileFor(user)?.role) !== "worker") return { data: null, error: { code: "42501", message: "Нужна роль грузчика" } };
    const job = db.jobs.find((j) => j.id === args._job_id);
    if (!job || job.dispatcher_id == null || !["active", "open"].includes(job.status)) return { data: null, error: { code: "P0001", message: "Заказ уже недоступен" } };
    const existing = db.job_responses.find((r) => r.job_id === job.id && r.worker_id === user.id && ["pending", "accepted"].includes(r.status));
    if (existing) return { data: null, error: { code: "23505", message: "Вы уже откликнулись на этот заказ" } };
    const response = {
      id: uid("response"),
      job_id: job.id,
      worker_id: user.id,
      message: String(args._message || "").trim() || null,
      status: "pending",
      worker_status: "ready",
      agreed_hourly_rate: Number(job.hourly_rate || 0),
      created_at: new Date().toISOString(),
    };
    db.job_responses.push(response); saveDb(db);
    return { data: response, error: null };
  }
  if (name === "accept_job_response") {
    if (!user) return { data: null, error: { code: "42501", message: "Не авторизован" } };
    const response = db.job_responses.find((r) => r.id === args._response_id && r.status === "pending");
    if (!response) return { data: null, error: { code: "P0002", message: "Отклик уже обработан" } };
    const job = db.jobs.find((j) => j.id === response.job_id);
    if (!job || job.dispatcher_id !== user.id) return { data: null, error: { code: "42501", message: "Нет доступа к отклику" } };
    const acceptedCount = db.job_responses.filter((r) => r.job_id === job.id && r.status === "accepted").length;
    const limit = Math.max(1, Number(job.workers_needed) || 1);
    if (acceptedCount >= limit) return { data: null, error: { code: "P0002", message: "Лимит грузчиков уже достигнут" } };
    response.status = "accepted";
    response.agreed_hourly_rate = response.agreed_hourly_rate || Number(job.hourly_rate || 0);
    const nextCount = acceptedCount + 1;
    const filled = nextCount >= limit;
    if (filled) {
      job.status = "filled";
      db.job_responses.filter((r) => r.job_id === job.id && r.status === "pending").forEach((r) => { r.status = "rejected"; });
    }
    saveDb(db);
    return { data: { accepted: true, filled, accepted_count: nextCount, workers_needed: limit, auto_rejected: filled ? db.job_responses.filter((r) => r.job_id === job.id && r.status === "rejected").length : 0, response_id: response.id }, error: null };
  }
  if (name === "worker_update_response_status") {
    if (!user) return { data: null, error: { code: "42501", message: "Не авторизован" } };
    const response = db.job_responses.find((r) => r.id === args._response_id && r.worker_id === user.id && r.status === "accepted");
    if (!response) return { data: null, error: { code: "42501", message: "Нет доступа к назначенному заказу" } };
    const allowed = ["confirmed", "en_route", "late", "arrived", "finishing", "completed"];
    if (!allowed.includes(args._next_status)) return { data: null, error: { code: "22023", message: "Недопустимый статус" } };
    const transitions: Record<string, string[]> = {
      accepted: ["confirmed"], confirmed: ["en_route", "late"], en_route: ["arrived", "late"],
      late: ["en_route", "arrived"], arrived: ["finishing", "completed"], finishing: ["completed"],
    };
    const current = response.worker_status || "accepted";
    if (!transitions[current]?.includes(args._next_status)) return { data: null, error: { code: "P0001", message: "Сначала выполните предыдущий шаг" } };
    const now = new Date().toISOString();
    response.worker_status = args._next_status;
    if (args._next_status === "arrived") response.work_started_at = response.work_started_at || now;
    if (args._next_status === "completed") {
      response.work_finished_at = now;
      const started = response.work_started_at ? new Date(response.work_started_at).getTime() : Date.now();
      response.hours_worked = Math.max(0, Math.round(((Date.now() - started) / 3600000) * 100) / 100);
      const job = db.jobs.find((j) => j.id === response.job_id);
      response.earned = response.hours_worked * Number(response.agreed_hourly_rate || job?.hourly_rate || 0);
      const otherActive = db.job_responses.some((r) => r.job_id === response.job_id && r.id !== response.id && r.status === "accepted" && r.worker_status !== "completed");
      if (!otherActive && job) job.status = "completed";
    }
    saveDb(db); return { data: response, error: null };
  }
  if (name === "worker_withdraw_response") {
    if (!user) return { data: null, error: { code: "42501", message: "Не авторизован" } };
    const response = db.job_responses.find((r) => r.id === args._response_id && r.worker_id === user.id && r.status === "pending");
    if (!response) return { data: null, error: { code: "P0001", message: "Этот отклик уже нельзя отозвать" } };
    response.status = "withdrawn";
    saveDb(db); return { data: response, error: null };
  }
  if (name === "dispatcher_reject_job_response") {
    if (!user) return { data: null, error: { code: "42501", message: "Не авторизован" } };
    const response = db.job_responses.find((r) => r.id === args._response_id && r.status === "pending");
    if (!response) return { data: null, error: { code: "P0001", message: "Этот отклик уже нельзя отклонить" } };
    const job = db.jobs.find((j) => j.id === response.job_id);
    if (!job || job.dispatcher_id !== user.id) return { data: null, error: { code: "42501", message: "Нет доступа к отклику" } };
    response.status = "rejected";
    saveDb(db); return { data: response, error: null };
  }
  if (name === "purchase_premium") {
    if (!user) return { data: null, error: { code: "42501", message: "Не авторизован" } };
    const role = user.user_metadata?.role || profileFor(user)?.role || "worker";
    const base = ({ worker_premium: 299, worker_vip: 599, disp_pro: 299, disp_business: 999 } as Record<string, number>)[args._tier_id];
    const multiplier = ({ month: 1, quarter: 2.5, year: 8 } as Record<string, number>)[args._period_id];
    if (!base || !multiplier || !((role === "worker" && String(args._tier_id).startsWith("worker_")) || (role === "dispatcher" && String(args._tier_id).startsWith("disp_")))) {
      return { data: null, error: { code: "22023", message: "Недопустимый тариф" } };
    }
    const dbProfile = db.profiles.find((p) => p.user_id === user.id);
    const price = Math.round(base * multiplier);
    const balance = Number(dbProfile?.balance || 0);
    if (balance < price) return { data: null, error: { code: "P0001", message: "Недостаточно средств" } };
    const days = args._period_id === "month" ? 30 : args._period_id === "quarter" ? 90 : 365;
    const until = new Date(Date.now() + days * 86400000).toISOString();
    if (dbProfile) Object.assign(dbProfile, { balance: balance - price, is_premium: true, premium_until: until, premium_plan: args._tier_id });
    saveDb(db);
    return { data: { tier_id: args._tier_id, period_id: args._period_id, price, premium_until: until, balance: balance - price }, error: null };
  }
  if (name === "purchase_company") {
    if (!user) return { data: null, error: { code: "42501", message: "Не авторизован" } };
    const prices: Record<string, number> = { starter: 1990, business: 4990, enterprise: 12990 };
    const price = prices[args._plan_id];
    if (!price || String(args._company_name || "").trim().length < 2) return { data: null, error: { code: "22023", message: "Проверьте тариф и название компании" } };
    const dbProfile = db.profiles.find((p) => p.user_id === user.id);
    const balance = Number(dbProfile?.balance || 0);
    if (balance < price) return { data: null, error: { code: "P0001", message: "Недостаточно средств" } };
    const until = new Date(Date.now() + 30 * 86400000).toISOString();
    if (dbProfile) Object.assign(dbProfile, { balance: balance - price, is_company: true, company_until: until, company_name: String(args._company_name).trim(), company_plan: args._plan_id });
    saveDb(db);
    return { data: { plan_id: args._plan_id, price, company_until: until, balance: balance - price }, error: null };
  }
  if (name === "get_job_party_profiles") {
    if (!user) return { data: null, error: { code: "42501", message: "Не авторизован" } };
    const job = db.jobs.find((j) => j.id === args._job_id);
    const participant = job && (job.client_id === user.id || job.dispatcher_id === user.id || db.job_responses.some((r) => r.job_id === job.id && r.worker_id === user.id && r.status === "accepted"));
    if (!participant) return { data: null, error: { code: "42501", message: "Нет доступа к заказу" } };
    const ids = Array.isArray(args._target_user_ids) ? args._target_user_ids : [];
    const rows = db.profiles.filter((p) => ids.includes(p.user_id) && job && (p.user_id === job.client_id || p.user_id === job.dispatcher_id || db.job_responses.some((r) => r.job_id === job.id && r.worker_id === p.user_id && r.status === "accepted")));
    return { data: rows.map((p) => ({ user_id: p.user_id, full_name: p.full_name || "", phone: p.phone || null, inn: p.inn || null, is_self_employed: !!p.is_self_employed, avatar_url: p.avatar_url || null, last_seen_at: p.last_seen_at || null })), error: null };
  }
  if (name === "dispatcher_create_replacement_job") {
    if (!user) return { data: null, error: { code: "42501", message: "Не авторизован" } };
    const job = db.jobs.find((j) => j.id === args._job_id && j.dispatcher_id === user.id);
    if (!job) return { data: null, error: { code: "P0002", message: "Заказ не найден" } };
    const workerId = args._worker_id || null;
    if (workerId) {
      const response = db.job_responses.find((r) => r.job_id === job.id && r.worker_id === workerId && r.status === "accepted");
      if (!response) return { data: null, error: { code: "P0001", message: "Грузчик не назначен" } };
      response.worker_status = "no_show"; response.status = "rejected";
    }
    const bonus = Math.max(0, Number(args._bonus) || 0);
    const replacement = { id: uid("job"), client_id: job.client_id, dispatcher_id: user.id, title: "🚨 СРОЧНО: " + job.title, description: ("СРОЧНАЯ ЗАМЕНА. Грузчик не вышел.\n\n" + String(job.description || "")).trim(), hourly_rate: Number(job.hourly_rate || 0) + bonus, duration_hours: job.duration_hours, workers_needed: 1, metro: job.metro, address: job.address, urgent: true, quick_minimum: true, status: "active", replacement_for_job_id: job.id, replacement_for_worker_id: workerId, start_time: new Date().toISOString(), created_at: new Date().toISOString() };
    db.jobs.push(replacement); saveDb(db); return { data: replacement, error: null };
  }
  if (name === "dispatcher_cancel_job") {
    if (!user) return { data: null, error: { code: "42501", message: "Не авторизован" } };
    const job = db.jobs.find((j) => j.id === args._job_id && j.dispatcher_id === user.id);
    if (!job || !["open", "active", "filled"].includes(job.status)) return { data: null, error: { code: "P0001", message: "Заявку нельзя закрыть" } };
    if (db.job_responses.some((r) => r.job_id === job.id && r.status === "accepted" && r.worker_status !== "completed")) return { data: null, error: { code: "P0001", message: "Нельзя закрыть заказ: грузчики уже назначены" } };
    job.status = "closed"; saveDb(db); return { data: { job_id: job.id, status: "closed" }, error: null };
  }
  if (name === "dispatcher_update_job") {
    if (!user) return { data: null, error: { code: "42501", message: "Не авторизован" } };
    const job = db.jobs.find((j) => j.id === args._job_id && j.dispatcher_id === user.id && ["open", "active", "filled"].includes(j.status));
    if (!job) return { data: null, error: { code: "42501", message: "Заявка недоступна для редактирования" } };
    const accepted = db.job_responses.filter((r) => r.job_id === job.id && r.status === "accepted").length;
    if (args._hourly_rate != null && Number(args._hourly_rate) !== Number(job.hourly_rate) && db.job_responses.some((r) => r.job_id === job.id && ["pending", "accepted"].includes(r.status))) {
      return { data: null, error: { code: "P0001", message: "hourly_rate_locked" } };
    }
    if (args._workers_needed != null && Number(args._workers_needed) < accepted) return { data: null, error: { code: "P0001", message: "workers_below_assigned" } };
    if (args._status != null && args._status !== job.status) return { data: null, error: { code: "P0001", message: "lifecycle_managed_status" } };
    if (args._title != null && String(args._title).trim()) job.title = String(args._title).trim();
    if (args._description != null) job.description = String(args._description);
    if (args._hourly_rate != null) job.hourly_rate = Number(args._hourly_rate);
    if (args._duration_hours != null) job.duration_hours = Number(args._duration_hours);
    if (args._workers_needed != null) job.workers_needed = Number(args._workers_needed);
    if (args._address != null) job.address = String(args._address).trim();
    if (args._metro != null) job.metro = String(args._metro).trim() || null;
    if (args._start_time != null) job.start_time = args._start_time;
    if (args._urgent != null) job.urgent = !!args._urgent;
    if (args._quick_minimum != null) job.quick_minimum = !!args._quick_minimum;
    if (args._requires_contract != null) job.requires_contract = !!args._requires_contract;
    job.updated_at = new Date().toISOString();
    saveDb(db); return { data: job, error: null };
  }
  if (name === "worker_review_dispatcher") {
    if (!user) return { data: null, error: { code: "42501", message: "Не авторизован" } };
    const role = user.user_metadata?.role || profileFor(user)?.role;
    if (role !== "worker") return { data: null, error: { code: "42501", message: "Нужна роль грузчика" } };
    const valid = db.job_responses.some((r) => r.worker_id === user.id && r.status === "accepted" && r.worker_status === "completed" && db.jobs.some((j) => j.id === r.job_id && j.dispatcher_id === args._dispatcher_id));
    if (!valid) return { data: null, error: { code: "P0001", message: "review_requires_completed_job" } };
    if (Number(args._rating) < 1 || Number(args._rating) > 5) return { data: null, error: { code: "22023", message: "Недопустимая оценка" } };
    const existing = db.dispatcher_reviews.find((r) => r.reviewer_id === user.id && r.dispatcher_id === args._dispatcher_id);
    const review = existing || { id: uid("review"), reviewer_id: user.id, dispatcher_id: args._dispatcher_id, created_at: new Date().toISOString() };
    review.rating = Number(args._rating); review.text = String(args._text || "").trim();
    if (!existing) db.dispatcher_reviews.push(review);
    saveDb(db); return { data: review, error: null };
  }
  if (name === "dispatcher_republish_job") {
    if (!user) return { data: null, error: { code: "42501", message: "Не авторизован" } };
    const job = db.jobs.find((j) => j.id === args._job_id && j.dispatcher_id === user.id && j.status === "closed");
    if (!job || db.job_responses.some((r) => r.job_id === args._job_id && r.status === "accepted")) return { data: null, error: { code: "P0001", message: "Заявка не может быть переопубликована" } };
    job.status = "active"; saveDb(db); return { data: job, error: null };
  }
  if (name === "admin_dashboard_stats") {
    const ratings = db.app_ratings || [];
    const now = Date.now();
    return { data: {
      totalUsers: db.profiles.length,
      onlineNow: db.profiles.filter((p) => p.last_seen_at && now - new Date(p.last_seen_at).getTime() < 120000).length,
      newToday: db.profiles.filter((p) => now - new Date(p.created_at || 0).getTime() < 86400000).length,
      newThisWeek: db.profiles.filter((p) => now - new Date(p.created_at || 0).getTime() < 7 * 86400000).length,
      avgRating: ratings.length ? Math.round((ratings.reduce((s, r) => s + Number(r.rating || 0), 0) / ratings.length) * 10) / 10 : 0,
      totalRatings: ratings.length,
    }, error: null };
  }
  if (name === "dispatcher_finish_job" || name === "dispatcher_complete_job" || name === "dispatcher_review_worker") return { data: {}, error: null };
  if (name === "create_direct_conversation") {
    if (!user || !args._other_user_id) return { data: null, error: { message: "invalid_participant" } };
    const existing = db.conversation_participants
      .filter((p) => p.user_id === user.id)
      .map((p) => p.conversation_id)
      .find((conversationId) => db.conversation_participants.some((p) => p.conversation_id === conversationId && p.user_id === args._other_user_id));
    if (existing) return { data: existing, error: null };
    const id = uid("conversation");
    db.conversations.push({ id, title: args._title || "Чат", created_at: new Date().toISOString() });
    if (user) db.conversation_participants.push({ id: uid("participant"), conversation_id: id, user_id: user.id, last_read_at: null, created_at: new Date().toISOString() });
    db.conversation_participants.push({ id: uid("participant"), conversation_id: id, user_id: args._other_user_id, last_read_at: null, created_at: new Date().toISOString() });
    saveDb(db); return { data: id, error: null };
  }
  if (name === "admin_list_users") return { data: db.profiles.map((p) => ({ ...p, user_id: p.user_id, role: p.role || "worker", email: "", verified: true, blocked: false })), error: null };
  return { data: null, error: null };
}

function createAuth() {
  return {
    onAuthStateChange(callback: (event: string, session: DemoSession | null) => void) {
      authListeners.add(callback);
      return { data: { subscription: { unsubscribe: () => authListeners.delete(callback) } } };
    },
    async getSession() { return { data: { session: currentSession() }, error: null }; },
    async getUser() { return { data: { user: currentSession()?.user || null }, error: null }; },
    async signUp({ email, password: _password, options }: any) {
      const user: DemoUser = { id: uid("user"), email, user_metadata: options?.data || {} };
      const session = { user, access_token: uid("token") };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      const db = loadDb();
      db.profiles.push({ user_id: user.id, full_name: user.user_metadata.full_name || "Новый пользователь", role: user.user_metadata.role || "worker", rating: 5, completed_orders: 0, total_earned: 0, balance: 0, is_premium: true, skills: [] });
      db.user_roles.push({ id: uid("role"), user_id: user.id, role: user.user_metadata.role || "worker" });
      saveDb(db); emitAuth("SIGNED_IN", session);
      return { data: { user, session }, error: null };
    },
    async signInWithPassword({ email, password: _password }: any) {
      const existing = currentSession();
      const user = existing?.user?.email === email ? existing.user : { id: "demo-worker", email, user_metadata: { role: "worker", full_name: "Демо-грузчик" } };
      const session = { user, access_token: uid("token") };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session)); emitAuth("SIGNED_IN", session);
      return { data: { user, session }, error: null };
    },
    async signOut() { localStorage.removeItem(SESSION_KEY); emitAuth("SIGNED_OUT", null); return { error: null }; },
    async updateUser(input: any) {
      const session = currentSession(); if (!session) return { data: { user: null }, error: { message: "Не авторизован" } };
      session.user.user_metadata = { ...session.user.user_metadata, ...(input.data || {}) };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session)); emitAuth("USER_UPDATED", session); return { data: { user: session.user }, error: null };
    },
  };
}

const storage = {
  from(bucket: string) {
    return {
      async upload(path: string, _file: any, _options?: any) { return { data: { path: `${bucket}/${path}` }, error: null }; },
      getPublicUrl(path: string) { return { data: { publicUrl: `/storage/${bucket}/${path}` } }; },
      async createSignedUrl(path: string, _expires: number) { return { data: { signedUrl: `/storage/${bucket}/${path}` }, error: null }; },
    };
  },
};

function channel(name: string) {
  const handlers: Array<(payload: any) => void> = [];
  const api = {
    on(_event: string, _filter: any, handler: (payload: any) => void) { handlers.push(handler); return api; },
    subscribe() { return api; },
    unsubscribe() { handlers.length = 0; },
  };
  return api;
}

const demoSupabase = {
  from: (table: string) => new QueryBuilder(table),
  rpc,
  auth: createAuth(),
  storage,
  functions: {
    async invoke(name: string, _options?: any) {
      if (name === "vapid-public-key") return { data: { publicKey: "" }, error: null };
      if (name === "smart-search-jobs") {
        const query = String(_options?.body?.query || "").trim().toLowerCase();
        const jobs = Array.isArray(_options?.body?.jobs) ? _options.body.jobs : [];
        const tokens = query.split(/\s+/).filter(Boolean);
        const ranked = !tokens.length ? jobs.map((j: any) => j.id) : jobs.map((job: any, index: number) => {
          const haystack = [job.title, job.description, job.address, job.metro].filter(Boolean).join(" ").toLowerCase();
          const score = tokens.reduce((sum: number, token: string) => sum + (haystack.includes(token) ? 1 : 0), 0);
          return { id: job.id, score, index };
        }).filter((x: any) => x.score > 0).sort((a: any, b: any) => b.score - a.score || a.index - b.index).map((x: any) => x.id);
        return { data: { job_ids: ranked }, error: null };
      }
      if (name === "moderate-content") return { data: { safe: true }, error: null };
      if (name === "improve-job-description") {
        const title = String(_options?.body?.title || "").trim();
        const description = String(_options?.body?.description || "").trim();
        return { data: { improved: description || ("Задача: " + title + ". Укажите объём работ, адрес, этаж, лифт и особенности объекта.") }, error: null };
      }
      return { data: {}, error: null };
    },
  },
  channel,
  removeChannel: (_channel: any) => {},
  removeAllChannels: () => {},
} as any;

export const supabase = demoSupabase;
export default demoSupabase;
export type LocalDatabase = Database;
