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
  });
});
