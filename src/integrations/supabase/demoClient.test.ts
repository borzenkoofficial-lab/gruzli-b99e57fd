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

  it("resolves another demo user's role from the seeded role table", async () => {
    localStorage.setItem("gruzli_demo_worker", "1");
    localStorage.setItem("gruzli_demo_role", "worker");

    const { data, error } = await demoSupabase.rpc("get_user_role", {
      _user_id: "demo-dispatcher",
    });

    expect(error).toBeNull();
    expect(data).toBe("dispatcher");
  });

  it("returns only seeded dispatcher directory fields from the demo RPC", async () => {
    localStorage.setItem("gruzli_demo_worker", "1");
    localStorage.setItem("gruzli_demo_role", "worker");

    const { data, error } = await demoSupabase.rpc("get_dispatcher_directory");

    expect(error).toBeNull();
    expect(data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        user_id: "demo-dispatcher",
        full_name: "Анна Петрова",
        rating: 4.9,
      }),
      expect.objectContaining({
        user_id: "demo-dispatcher-1",
        full_name: "Алексей",
      }),
    ]));
    expect(data.every((row: Record<string, unknown>) =>
      ["user_id", "full_name", "avatar_url", "rating", "completed_orders", "last_seen_at", "isOnline"]
        .every((key) => key in row)
    )).toBe(true);
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
