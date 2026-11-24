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

  const databaseBefore = await page.evaluate(() => localStorage.getItem("gruzli_demo_db_v3"));
  await roleSelect.selectOption("dispatcher");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("gruzli_demo_role"))).toBe("dispatcher");
  await expect(roleSelect).toHaveValue("dispatcher");

  await roleSelect.selectOption("client");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("gruzli_demo_role"))).toBe("client");
  await expect(roleSelect).toHaveValue("client");

  await roleSelect.selectOption("worker");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("gruzli_demo_role"))).toBe("worker");
  const databaseAfter = await page.evaluate(() => localStorage.getItem("gruzli_demo_db_v3"));
  expect(databaseAfter).toBe(databaseBefore);
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
