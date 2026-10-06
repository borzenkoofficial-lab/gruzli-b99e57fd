import type { Tables } from "@/integrations/supabase/types";

export type DemoRole = "worker" | "dispatcher" | "client";

export const DEMO_USERS: Record<DemoRole, {
  id: string;
  name: string;
  email: string;
  role: DemoRole;
}> = {
  worker: { id: "demo-worker", name: "Алексей Морозов", email: "demo-worker@gruzli.local", role: "worker" },
  dispatcher: { id: "demo-dispatcher", name: "Анна Петрова", email: "demo-dispatcher@gruzli.local", role: "dispatcher" },
  client: { id: "demo-client", name: "Сергей Волков", email: "demo-client@gruzli.local", role: "client" },
};

export const DEMO_DISPATCHER_NAMES: Record<string, string> = {
  "demo-dispatcher-1": "Алексей",
  "demo-dispatcher-2": "Мария",
  "demo-dispatcher-3": "Gruzli",
  "demo-dispatcher-4": "Илья",
  "demo-dispatcher-5": "Анна",
};

export const DEMO_FEED_JOBS: Tables<"jobs">[] = [
  {
    id: "demo-job-1", client_id: "demo-client", title: "Переезд квартиры · Сокольники",
    description: "Нужно 2 грузчика: мебель, коробки и техника. Лифт есть.",
    address: "Москва, ул. Стромынка, 18", metro: "Сокольники", hourly_rate: 900, duration_hours: 5,
    workers_needed: 2, urgent: true, quick_minimum: false, is_bot: false, is_official: true,
    dispatcher_id: "demo-dispatcher-1", dispatcher_income: null, expense_per_worker: null,
    requires_contract: false, recurring_rule: null, replacement_for_job_id: null, replacement_for_worker_id: null,
    template_id: null, status: "active", created_at: "2026-09-29T17:30:00Z", updated_at: "2026-09-29T17:30:00Z",
    start_time: "2026-09-30T10:00:00+03:00",
  },
  {
    id: "demo-job-2", client_id: "demo-client", title: "Разгрузка фуры · Химки",
    description: "Разгрузить бытовую технику на складе. Работа без ночёвки.",
    address: "Химки, Ленинградское шоссе, 23", metro: "Ховрино", hourly_rate: 750, duration_hours: 6,
    workers_needed: 4, urgent: false, quick_minimum: true, is_bot: false, is_official: false,
    dispatcher_id: "demo-dispatcher-2", dispatcher_income: null, expense_per_worker: null,
    requires_contract: false, recurring_rule: null, replacement_for_job_id: null, replacement_for_worker_id: null,
    template_id: null, status: "active", created_at: "2026-09-29T16:45:00Z", updated_at: "2026-09-29T16:45:00Z",
    start_time: "2026-09-30T11:00:00+03:00",
  },
  {
    id: "demo-job-3", client_id: "demo-client", title: "Демонтаж перегородок · Москва-Сити",
    description: "Ручной демонтаж гипсокартона, вынос и сортировка материалов.",
    address: "Москва, Пресненская наб., 8", metro: "Деловой центр", hourly_rate: 1000, duration_hours: 7,
    workers_needed: 3, urgent: false, quick_minimum: false, is_bot: false, is_official: true,
    dispatcher_id: "demo-dispatcher-3", dispatcher_income: null, expense_per_worker: null,
    requires_contract: false, recurring_rule: null, replacement_for_job_id: null, replacement_for_worker_id: null,
    template_id: null, status: "active", created_at: "2026-09-29T15:20:00Z", updated_at: "2026-09-29T15:20:00Z",
    start_time: "2026-10-01T09:00:00+03:00",
  },
  {
    id: "demo-job-4", client_id: "demo-client", title: "Подъём стройматериалов · Арбат",
    description: "Поднять материалы на 5 этаж. Лифт для грузов отсутствует.",
    address: "Москва, ул. Арбат, 41", metro: "Арбатская", hourly_rate: 850, duration_hours: 4,
    workers_needed: 2, urgent: false, quick_minimum: false, is_bot: false, is_official: false,
    dispatcher_id: "demo-dispatcher-4", dispatcher_income: null, expense_per_worker: null,
    requires_contract: false, recurring_rule: null, replacement_for_job_id: null, replacement_for_worker_id: null,
    template_id: null, status: "active", created_at: "2026-09-29T14:10:00Z", updated_at: "2026-09-29T14:10:00Z",
    start_time: "2026-10-01T13:00:00+03:00",
  },
  {
    id: "demo-job-5", client_id: "demo-client", title: "Погрузка мебели · Одинцово",
    description: "Погрузить мебель в газель, аккуратно упаковать стекло и крупные предметы.",
    address: "Одинцово, Можайское шоссе, 112", metro: "Одинцово", hourly_rate: 800, duration_hours: 5,
    workers_needed: 3, urgent: false, quick_minimum: true, is_bot: false, is_official: false,
    dispatcher_id: "demo-dispatcher-5", dispatcher_income: null, expense_per_worker: null,
    requires_contract: false, recurring_rule: null, replacement_for_job_id: null, replacement_for_worker_id: null,
    template_id: null, status: "active", created_at: "2026-09-29T13:00:00Z", updated_at: "2026-09-29T13:00:00Z",
    start_time: "2026-10-02T10:00:00+03:00",
  },
];

export const DEMO_WORKER_PROFILE = {
  full_name: DEMO_USERS.worker.name,
  role: "worker" as const,
  rating: 4.96,
  completed_orders: 128,
  total_earned: 186400,
  balance: 12450,
  is_premium: true,
  premium_until: "2026-12-31T23:59:59Z",
  skills: ["Переезды", "Разгрузка", "Демонтаж"],
};

export const DEMO_RESPONSE_COUNTS: Record<string, number> = {
  "demo-job-1": 1,
  "demo-job-2": 3,
  "demo-job-3": 2,
  "demo-job-4": 0,
  "demo-job-5": 1,
};
