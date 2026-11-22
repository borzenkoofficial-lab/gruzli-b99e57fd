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


for (const viewport of [{ width: 768, height: 900 }, { width: 1280, height: 800 }]) {
  test(`Gruzli desktop layout uses real workspace columns at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      localStorage.setItem("gruzli_demo_worker", "1");
      localStorage.setItem("gruzli_demo_role", "worker");
      localStorage.setItem("onboarding_completed", "1");
    });

    await page.goto("/");
    await expect(page.locator(".desktop-shell")).toBeVisible();
    await expect(page.locator(".desktop-topbar")).toBeVisible();

    const layout = await page.evaluate(() => {
      const shell = document.querySelector(".desktop-shell");
      const sidebar = document.querySelector(".desktop-sidebar");
      const workspace = document.querySelector(".desktop-workspace");
      const body = document.querySelector(".desktop-body");
      const main = document.querySelector(".desktop-main");
      const shellStyle = shell ? getComputedStyle(shell) : null;
      const bodyStyle = body ? getComputedStyle(body) : null;
      const sidebarRect = sidebar?.getBoundingClientRect();
      const workspaceRect = workspace?.getBoundingClientRect();
      const mainRect = main?.getBoundingClientRect();

      return {
        shellDisplay: shellStyle?.display,
        bodyDisplay: bodyStyle?.display,
        sidebarWidth: sidebarRect?.width ?? 0,
        workspaceLeft: workspaceRect?.left ?? 0,
        mainLeft: mainRect?.left ?? 0,
        mainWidth: mainRect?.width ?? 0,
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
      };
    });

    expect(layout.shellDisplay).toBe("flex");
    expect(layout.bodyDisplay).toBe("flex");
    expect(layout.sidebarWidth).toBeGreaterThanOrEqual(72);
    expect(layout.workspaceLeft).toBeGreaterThanOrEqual(layout.sidebarWidth - 1);
    expect(layout.mainWidth).toBeGreaterThan(300);
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  });
}
