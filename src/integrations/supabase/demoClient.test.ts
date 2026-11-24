import { describe, expect, beforeEach, afterEach, it } from "vitest";
import demoSupabase, { resetDemoDatabase } from "./demoClient";

describe("demo Supabase session", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("derives the active demo role for RPC calls on a clean browser", async () => {
    localStorage.setItem("gruzli_demo_worker", "1");
    localStorage.setItem("gruzli_demo_role", "worker");

    const { data, error } = await demoSupabase.rpc("get_user_role");

    expect(error).toBeNull();
    expect(data).toBe("worker");
  });

  it("accepts a worker response without a separately persisted auth session", async () => {
    localStorage.setItem("gruzli_demo_worker", "1");
    localStorage.setItem("gruzli_demo_role", "worker");

    const { data, error } = await demoSupabase.rpc("worker_submit_response", {
      _job_id: "demo-job-4",
      _message: "Готов выйти на заказ.",
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({
      job_id: "demo-job-4",
      worker_id: "demo-worker",
      status: "pending",
    });
  });
});


const DB_KEY = "gruzli_demo_db_v3";

function useRole(role: "client" | "dispatcher" | "worker") {
  localStorage.setItem("gruzli_demo_worker", "1");
  localStorage.setItem("gruzli_demo_role", role);
}

describe("local demo order lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
    resetDemoDatabase();
    localStorage.setItem("onboarding_completed", "1");
  });

  it("runs a client → dispatcher → worker → dispatcher order lifecycle in one shared database", async () => {
    useRole("client");
    const created = await demoSupabase.rpc("client_create_job", {
      _title: "Тестовый заказ на демонтаж",
      _description: "Проверка полного цикла",
      _address: "Москва, Тестовая улица, 10",
      _metro: "Тестовая",
      _hourly_rate: 1200,
      _duration_hours: 4,
      _workers_needed: 1,
      _start_time: "2026-11-25T10:00:00.000Z",
    });

    expect(created.error).toBeNull();
    const jobId = created.data.id as string;

    useRole("dispatcher");
    const submittedOffer = await demoSupabase.rpc("dispatcher_submit_offer", {
      _job_id: jobId,
      _proposed_hourly_rate: 1300,
      _proposed_workers: 1,
      _message: "Бригада готова",
    });
    expect(submittedOffer.error).toBeNull();

    useRole("client");
    const selected = await demoSupabase.rpc("client_select_dispatcher_offer", {
      _offer_id: submittedOffer.data.id,
    });
    expect(selected.error).toBeNull();
    expect(selected.data.dispatcher_id).toBe("demo-dispatcher");

    useRole("worker");
    const workerResponse = await demoSupabase.rpc("worker_submit_response", {
      _job_id: jobId,
      _message: "Готов выйти",
    });
    expect(workerResponse.error).toBeNull();

    useRole("dispatcher");
    const accepted = await demoSupabase.rpc("accept_job_response", {
      _response_id: workerResponse.data.id,
    });
    expect(accepted.error).toBeNull();
    expect(accepted.data.filled).toBe(true);

    useRole("worker");
    for (const nextStatus of ["confirmed", "en_route", "arrived", "completed"]) {
      const update = await demoSupabase.rpc("worker_update_response_status", {
        _response_id: workerResponse.data.id,
        _next_status: nextStatus,
      });
      expect(update.error).toBeNull();
      expect(update.data.worker_status).toBe(nextStatus);
    }

    useRole("dispatcher");
    const finish = await demoSupabase.rpc("dispatcher_finish_job", { _job_id: jobId });
    expect(finish.error).toBeNull();
    expect(finish.data.status).toBe("finishing");

    const review = await demoSupabase.rpc("dispatcher_review_worker", {
      _response_id: workerResponse.data.id,
      _rating: 5,
      _text: "Отличная работа",
    });
    expect(review.error).toBeNull();

    const complete = await demoSupabase.rpc("dispatcher_complete_job", {
      _job_id: jobId,
      _expense_per_worker: 4000,
      _dispatcher_income: 1000,
    });
    expect(complete.error).toBeNull();
    expect(complete.data.status).toBe("completed");

    const db = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
    expect(db.jobs.find((job: any) => job.id === jobId)).toMatchObject({
      status: "completed",
      expense_per_worker: 4000,
      dispatcher_income: 1000,
    });
    expect(db.job_responses.find((response: any) => response.id === workerResponse.data.id)).toMatchObject({
      status: "accepted",
      worker_status: "completed",
      dispatcher_review_rating: 5,
      dispatcher_review_text: "Отличная работа",
    });
  });

  it("rejects role violations and invalid worker status jumps without mutating records", async () => {
    useRole("client");
    const created = await demoSupabase.rpc("client_create_job", {
      _title: "Проверка доступа",
      _address: "Москва, Тестовая улица, 11",
      _hourly_rate: 800,
      _duration_hours: 3,
      _workers_needed: 1,
    });
    const jobId = created.data.id as string;

    const forbidden = await demoSupabase.rpc("dispatcher_finish_job", { _job_id: jobId });
    expect(forbidden.error?.code).toBe("42501");

    useRole("dispatcher");
    const offer = await demoSupabase.rpc("dispatcher_submit_offer", {
      _job_id: jobId,
      _proposed_hourly_rate: 800,
      _proposed_workers: 1,
    });
    useRole("client");
    await demoSupabase.rpc("client_select_dispatcher_offer", { _offer_id: offer.data.id });

    useRole("worker");
    const response = await demoSupabase.rpc("worker_submit_response", { _job_id: jobId });
    useRole("dispatcher");
    await demoSupabase.rpc("accept_job_response", { _response_id: response.data.id });
    useRole("worker");

    const invalidJump = await demoSupabase.rpc("worker_update_response_status", {
      _response_id: response.data.id,
      _next_status: "arrived",
    });
    expect(invalidJump.error?.code).toBe("P0001");

    const db = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
    expect(db.job_responses.find((item: any) => item.id === response.data.id).worker_status).toBe("ready");
  });

  it("resets only the demo database while preserving the active role and app preferences", async () => {
    useRole("dispatcher");
    localStorage.setItem("onboarding_completed", "1");
    localStorage.setItem("unrelated-preference", "keep-me");

    useRole("client");
    const temporaryJob = await demoSupabase.rpc("client_create_job", {
      _title: "Временная заявка",
      _address: "Москва, Тестовая улица, 12",
      _hourly_rate: 500,
      _duration_hours: 2,
      _workers_needed: 1,
    });
    expect(temporaryJob.error).toBeNull();
    useRole("dispatcher");

    resetDemoDatabase();

    expect(localStorage.getItem("gruzli_demo_worker")).toBe("1");
    expect(localStorage.getItem("gruzli_demo_role")).toBe("dispatcher");
    expect(localStorage.getItem("onboarding_completed")).toBe("1");
    expect(localStorage.getItem("unrelated-preference")).toBe("keep-me");
    expect(localStorage.getItem(DB_KEY)).toBeNull();

    const seeded = await demoSupabase.from("jobs").select("*");
    expect(seeded.data.some((job: any) => job.id === "demo-job-open-dispatch")).toBe(true);
    expect(seeded.data.some((job: any) => job.title === "Временная заявка")).toBe(false);
  });
});
