import { describe, expect, beforeEach, afterEach, it } from "vitest";
import demoSupabase from "./demoClient";

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

  it("blocks admin RPCs for non-admin demo roles", async () => {
    localStorage.setItem("gruzli_demo_worker", "1");
    localStorage.setItem("gruzli_demo_role", "worker");

    const stats = await demoSupabase.rpc("admin_dashboard_stats");
    const users = await demoSupabase.rpc("admin_list_users");

    expect(stats.error?.code).toBe("42501");
    expect(users.error?.code).toBe("42501");
  });

  it("runs the worker completion lifecycle and calculates earnings", async () => {
    localStorage.setItem("gruzli_demo_worker", "1");
    localStorage.setItem("gruzli_demo_role", "worker");

    const response = await demoSupabase.rpc("worker_submit_response", {
      _job_id: "demo-job-4",
      _message: "Готов выйти на заказ.",
    });
    expect(response.error).toBeNull();

    localStorage.setItem("gruzli_demo_role", "dispatcher");
    const accepted = await demoSupabase.rpc("accept_job_response", {
      _response_id: response.data.id,
    });
    expect(accepted.error).toBeNull();

    localStorage.setItem("gruzli_demo_role", "worker");
    for (const status of ["confirmed", "en_route", "arrived", "completed"]) {
      const updated = await demoSupabase.rpc("worker_update_response_status", {
        _response_id: response.data.id,
        _next_status: status,
      });
      expect(updated.error).toBeNull();
    }

    const { data: completed } = await demoSupabase.from("job_responses").select("*").eq("id", response.data.id).single();
    expect(completed).toMatchObject({ status: "accepted", worker_status: "completed" });
    expect(Number(completed.hours_worked)).toBeGreaterThanOrEqual(0.5);
    expect(Number(completed.earned)).toBeGreaterThan(0);

    const { data: jobAfterWorker } = await demoSupabase.from("jobs").select("*").eq("id", "demo-job-4").single();
    expect(jobAfterWorker.status).not.toBe("completed");
  });

  it("does not allow closing a dispatcher job while a worker is unfinished", async () => {
    localStorage.setItem("gruzli_demo_worker", "1");
    localStorage.setItem("gruzli_demo_role", "dispatcher");

    const result = await demoSupabase.rpc("dispatcher_complete_job", {
      _job_id: "demo-job-1",
      _expense_per_worker: 700,
      _dispatcher_income: 1000,
    });

    expect(result.error?.code).toBe("P0001");
  });

  it("keeps the client -> dispatcher offer flow aligned with production rules", async () => {
    localStorage.setItem("gruzli_demo_worker", "1");
    localStorage.setItem("gruzli_demo_role", "client");

    const created = await demoSupabase.rpc("client_create_job", {
      _title: "Тестовый заказ",
      _description: "Без адреса на первом шаге.",
      _hourly_rate: 800,
      _start_time: null,
      _duration_hours: 4,
      _address: "",
      _metro: "",
      _workers_needed: 2,
    });

    expect(created.error).toBeNull();
    expect(created.data).toMatchObject({
      title: "Тестовый заказ",
      address: "",
      status: "open",
      dispatcher_id: null,
      client_id: "demo-client",
    });

    localStorage.setItem("gruzli_demo_role", "worker");
    const denied = await demoSupabase.rpc("client_create_job", {
      _title: "Не должен создаться",
      _description: "",
      _hourly_rate: 800,
      _start_time: null,
      _duration_hours: 4,
      _address: "",
      _metro: "",
      _workers_needed: 1,
    });
    expect(denied.error?.code).toBe("42501");

    localStorage.setItem("gruzli_demo_role", "dispatcher");
    const offer = await demoSupabase.rpc("dispatcher_submit_offer", {
      _job_id: created.data.id,
      _proposed_hourly_rate: 850,
      _proposed_workers: 2,
      _message: "Готов собрать команду.",
    });

    expect(offer.error).toBeNull();
    expect(offer.data).toMatchObject({
      job_id: created.data.id,
      dispatcher_id: "demo-dispatcher",
      status: "pending",
    });

    localStorage.setItem("gruzli_demo_role", "client");
    const selected = await demoSupabase.rpc("client_select_dispatcher_offer", {
      _offer_id: offer.data.id,
    });

    expect(selected.error).toBeNull();
    expect(selected.data).toMatchObject({
      id: created.data.id,
      dispatcher_id: "demo-dispatcher",
      status: "active",
      hourly_rate: 850,
      workers_needed: 2,
    });
  });
});
