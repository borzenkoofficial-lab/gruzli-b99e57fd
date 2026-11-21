import { test, expect } from "@playwright/test";

test("Gruzli boots into the demo worker workspace", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("gruzli_demo_worker", "1");
    localStorage.setItem("gruzli_demo_role", "worker");
    localStorage.setItem("onboarding_completed", "1");
  });

  await page.goto("/");
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.getByText("Gruzli").first()).toBeVisible();
  await expect(page.getByText("Лента заявок").first()).toBeVisible();
});


test("Gruzli keeps the mobile shell usable at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("gruzli_demo_worker", "1");
    localStorage.setItem("gruzli_demo_role", "worker");
    localStorage.setItem("onboarding_completed", "1");
  });

  await page.goto("/");
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.locator(".gruzli-mobile-feed")).toBeVisible();
  await expect(page.locator(".bottom-nav-wrapper")).toBeVisible();
  await expect(page.locator(".gruzli-job-card").first()).toBeVisible();
});


for (const viewport of [{ width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
  test(`Gruzli desktop workspace stays inside ${viewport.width}px viewport`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      localStorage.setItem("gruzli_demo_worker", "1");
      localStorage.setItem("gruzli_demo_role", "worker");
      localStorage.setItem("onboarding_completed", "1");
    });

    await page.goto("/");
    await expect(page.locator(".desktop-shell")).toBeVisible();
    await expect(page.locator(".desktop-sidebar")).toBeVisible();
    await expect(page.locator(".desktop-main")).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      shellWidth: document.querySelector(".desktop-shell")?.scrollWidth ?? 0,
    }));

    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.shellWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  });
}
