import type { Database } from "./types";

type DemoUser = {
  id: string;
  email: string;
  phone?: string | null;
  user_metadata: Record<string, any>;
};

type DemoSession = { user: DemoUser; access_token: string };

type Row = Record<string, any>;

const DB_KEY = "gruzli_demo_db_v1";
const SESSION_KEY = "gruzli_demo_session_v1";

const seed: Record<string, Row[]> = {
  jobs: [
    { id: "demo-job-1", title: "Разгрузка стройматериалов", description: "Разгрузить материалы на объекте.", address: "Москва, ул. Лесная, 12", metro: "Белорусская", hourly_rate: 850, duration_hours: 5, workers_needed: 3, status: "active", created_at: new Date().toISOString(), start_time: new Date(Date.now()+86400000).toISOString(), dispatcher_id: "demo-dispatcher", client_id: "demo-client" },
    { id: "demo-job-2", title: "Переезд офиса", description: "Перенос мебели и коробок.", address: "Москва, Пресненская наб., 8", metro: "Деловой центр", hourly_rate: 900, duration_hours: 6, workers_needed: 4, status: "active", created_at: new Date(Date.now()-3600000).toISOString(), start_time: new Date(Date.now()+172800000).toISOString(), dispatcher_id: "demo-dispatcher", client_id: "demo-client" },
  ],
  profiles: [
    { user_id: "demo-worker", full_name: "Демо-грузчик", phone: "+7 900 000-00-01", role: "worker", rating: 4.96, completed_orders: 128, total_earned: 186400, balance: 12450, is_premium: true, skills: ["Переезды","Разгрузка","Демонтаж"], availability: [true,true,true,true,true,true,true] },
    { user_id: "demo-dispatcher", full_name: "Алексей Смирнов", phone: "+7 900 000-00-02", role: "dispatcher", rating: 4.9, completed_orders: 342 },
    { user_id: "demo-client", full_name: "ООО «Грузли»", phone: "+7 900 000-00-03", role: "client" },
  ],
  profiles_public: [
    { user_id: "demo-worker", full_name: "Демо-грузчик", avatar_url: null, rating: 4.96, completed_orders: 128, verified: true },
    { user_id: "demo-dispatcher", full_name: "Алексей Смирнов", avatar_url: null, rating: 4.9, completed_orders: 342, verified: true },
  ],
  dispatcher_offers: [
    { id: "demo-offer-1", job_id: "demo-job-1", dispatcher_id: "demo-dispatcher", proposed_hourly_rate: 850, proposed_workers: 3, message: "Готов закрыть заказ командой из трёх грузчиков.", status: "pending", created_at: new Date().toISOString() },
  ],
  job_responses: [],
  conversations: [],
  conversation_participants: [],
  messages: [],
  user_roles: [
    { id: "demo-role-1", user_id: "demo-worker", role: "worker" },
    { id: "demo-role-2", user_id: "demo-dispatcher", role: "dispatcher" },
    { id: "demo-role-3", user_id: "demo-client", role: "client" },
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

function currentSession(): DemoSession | null {
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
        const duplicate = incoming.find((item) => db[this.table].some((existing) =>
          existing.job_id === item.job_id && existing.worker_id === item.worker_id
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
  if (name === "get_support_user_id") return { data: "demo-support", error: null };
  if (name === "client_create_job") {
    const job = { id: uid("job"), title: args._title, description: args._description, address: args._address, metro: args._metro, duration_hours: args._duration_hours, hourly_rate: args._hourly_rate, workers_needed: args._workers_needed, start_time: args._start_time, status: "open", client_id: user?.id, dispatcher_id: null, created_at: new Date().toISOString() };
    db.jobs.push(job); saveDb(db); return { data: job, error: null };
  }
  if (name === "dispatcher_submit_offer") {
    if (!user) return { data: null, error: { message: "Не авторизован" } };
    const job = db.jobs.find((j) => j.id === args._job_id);
    if (!job || job.status !== "open" || job.dispatcher_id) return { data: null, error: { message: "unavailable" } };
    const duplicate = db.dispatcher_offers.find((o) => o.job_id === args._job_id && o.dispatcher_id === user.id && o.status === "pending");
    if (duplicate) return { data: null, error: { code: "23505", message: "Предложение уже отправлено" } };
    const offer = { id: uid("offer"), job_id: args._job_id, dispatcher_id: user.id, proposed_hourly_rate: args._proposed_hourly_rate, proposed_workers: args._proposed_workers, message: args._message || "", status: "pending", created_at: new Date().toISOString() };
    db.dispatcher_offers.push(offer); saveDb(db); return { data: offer, error: null };
  }
  if (name === "client_select_dispatcher_offer") {
    const offer = db.dispatcher_offers.find((o) => o.id === args._offer_id);
    if (!offer) return { data: null, error: { message: "Отклик не найден" } };
    const job = db.jobs.find((j) => j.id === offer.job_id);
    if (!job || job.status !== "open" || job.dispatcher_id) return { data: null, error: { message: "unavailable" } };
    job.dispatcher_id = offer.dispatcher_id; job.status = "active";
    job.hourly_rate = offer.proposed_hourly_rate; job.workers_needed = offer.proposed_workers;
    db.dispatcher_offers.filter((o) => o.job_id === offer.job_id).forEach((o) => { o.status = o.id === offer.id ? "accepted" : "rejected"; });
    saveDb(db); return { data: job, error: null };
  }
  if (name === "accept_job_response") {
    const response = db.job_responses.find((r) => r.id === args._response_id);
    if (response) response.status = "accepted";
    saveDb(db); return { data: { accepted: true, filled: false, response_id: args._response_id }, error: null };
  }
  if (name === "worker_update_response_status") {
    const response = db.job_responses.find((r) => r.id === args._response_id);
    if (response) response.worker_status = args._next_status;
    saveDb(db); return { data: response || { worker_status: args._next_status }, error: null };
  }
  if (name === "worker_withdraw_response") {
    const response = db.job_responses.find((r) => r.id === args._response_id);
    if (response) response.status = "withdrawn";
    saveDb(db); return { data: response || null, error: null };
  }
  if (name === "dispatcher_reject_job_response") {
    const response = db.job_responses.find((r) => r.id === args._response_id);
    if (response) response.status = "rejected";
    saveDb(db); return { data: response || null, error: null };
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

export const supabase = {
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

export type LocalDatabase = Database;
