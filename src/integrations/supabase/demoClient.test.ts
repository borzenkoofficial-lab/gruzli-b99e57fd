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
});
