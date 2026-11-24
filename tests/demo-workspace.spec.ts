import { expect, test } from "@playwright/test";

test("demo entry lets the tester choose each of the three roles", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding_completed", "1");
  });

  await page.goto("/");
  await expect(page.getByTestId("demo-role-client")).toBeVisible();
  await page.getByTestId("demo-role-dispatcher").click();
  await expect(page.getByTestId("demo-role-dispatcher")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("open-demo").click();

  await expect(page.getByTestId("demo-mode-bar")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Тестовая роль" })).toHaveValue("dispatcher");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("gruzli_demo_role"))).toBe("dispatcher");
});

test("switching demo roles preserves the shared local database", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("gruzli_demo_worker", "1");
    localStorage.setItem("gruzli_demo_role", "worker");
    localStorage.setItem("onboarding_completed", "1");
  });

  await page.goto("/");
  const roleSelect = page.getByRole("combobox", { name: "Тестовая роль" });
  await expect(roleSelect).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("gruzli_demo_db_v3"))).not.toBeNull();

  const jobIdsBefore = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("gruzli_demo_db_v3") || "{}");
    return (db.jobs || []).map((job: { id: string }) => job.id).sort();
  });
  await roleSelect.selectOption("dispatcher");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("gruzli_demo_role"))).toBe("dispatcher");
  await expect(roleSelect).toHaveValue("dispatcher");

  await roleSelect.selectOption("client");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("gruzli_demo_role"))).toBe("client");
  await expect(roleSelect).toHaveValue("client");

  await roleSelect.selectOption("worker");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("gruzli_demo_role"))).toBe("worker");
  const jobIdsAfter = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("gruzli_demo_db_v3") || "{}");
    return (db.jobs || []).map((job: { id: string }) => job.id).sort();
  });
  expect(jobIdsAfter).toEqual(jobIdsBefore);
});

test("demo reset rebuilds only the local demo database", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("gruzli_demo_worker", "1");
    localStorage.setItem("gruzli_demo_role", "dispatcher");
    localStorage.setItem("onboarding_completed", "1");
    localStorage.setItem("gruzli_demo_db_v3", JSON.stringify({ jobs: [{ id: "temporary-test-row" }] }));
    localStorage.setItem("user-preference-test", "preserve");
  });
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/");
  await page.getByRole("button", { name: "Сброс" }).click();
  await expect(page.getByTestId("demo-mode-bar")).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("gruzli_demo_role"))).toBe("dispatcher");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("user-preference-test"))).toBe("preserve");
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem("gruzli_demo_db_v3");
    if (!raw) return false;
    const db = JSON.parse(raw);
    return db.jobs?.some((job: { id: string }) => job.id === "demo-job-open-dispatch") &&
      !db.jobs?.some((job: { id: string }) => job.id === "temporary-test-row");
  })).toBe(true);
});


test("worker can confirm an accepted response initialized as ready", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("gruzli_demo_worker", "1");
    localStorage.setItem("gruzli_demo_role", "worker");
    localStorage.setItem("onboarding_completed", "1");
    localStorage.setItem("gruzli_demo_db_v3", JSON.stringify({
      jobs: [{
        id: "demo-ready-job",
        client_id: "demo-client",
        dispatcher_id: "demo-dispatcher",
        title: "Тест подтверждения заказа",
        description: "Проверка статуса ready",
        address: "Москва, Тестовая улица, 20",
        metro: "Тестовая",
        hourly_rate: 900,
        duration_hours: 4,
        workers_needed: 1,
        status: "filled",
        created_at: "2026-11-24T09:00:00.000Z",
      }],
      job_responses: [{
        id: "demo-ready-response",
        job_id: "demo-ready-job",
        worker_id: "demo-worker",
        status: "accepted",
        worker_status: "ready",
        agreed_hourly_rate: 900,
        created_at: "2026-11-24T09:05:00.000Z",
      }],
      profiles_public: [{
        user_id: "demo-dispatcher",
        full_name: "Анна Петрова",
        avatar_url: null,
      }],
    }));
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "Заказы" }).click();
  await expect(page.getByRole("button", { name: /Подтвердить заказ/ })).toBeVisible();
  await page.getByRole("button", { name: /Подтвердить заказ/ }).click();
  await expect(page.getByRole("button", { name: "Выехал" })).toBeVisible();
});
