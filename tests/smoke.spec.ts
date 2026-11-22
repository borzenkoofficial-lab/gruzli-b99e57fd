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


for (const viewport of [{ width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
  test(`Gruzli keeps job details readable beside the feed at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      localStorage.setItem("gruzli_demo_worker", "1");
      localStorage.setItem("gruzli_demo_role", "worker");
      localStorage.setItem("onboarding_completed", "1");
    });

    await page.goto("/");
    const firstJob = page.locator(".gruzli-job-card").first();
    await expect(firstJob).toBeVisible();
    await firstJob.click();

    const detail = page.locator(".desktop-detail");
    await expect(detail).toBeVisible();

    const geometry = await page.evaluate(() => {
      const main = document.querySelector(".desktop-main")?.getBoundingClientRect();
      const detail = document.querySelector(".desktop-detail")?.getBoundingClientRect();
      const shell = document.querySelector(".desktop-shell")?.getBoundingClientRect();
      return {
        mainWidth: main?.width ?? 0,
        detailWidth: detail?.width ?? 0,
        detailLeft: detail?.left ?? 0,
        detailRight: detail?.right ?? 0,
        shellRight: shell?.right ?? 0,
        viewportWidth: window.innerWidth,
      };
    });

    expect(geometry.mainWidth).toBeGreaterThanOrEqual(280);
    expect(geometry.detailWidth).toBeGreaterThanOrEqual(260);
    expect(geometry.detailLeft).toBeGreaterThan(0);
    expect(geometry.detailRight).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.shellRight).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  });
}


test("Client order form stays inside the desktop application shell", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("gruzli_demo_worker", "1");
    localStorage.setItem("gruzli_demo_role", "client");
    localStorage.setItem("onboarding_completed", "1");
  });

  await page.goto("/");
  const shell = page.locator(".desktop-shell");
  const sidebar = page.locator(".desktop-sidebar");
  const form = page.locator(".gruzli-create-job-screen");

  await expect(shell).toBeVisible();
  await expect(sidebar).toBeVisible();
  await expect(form).toBeVisible();
  await expect(page.getByRole("heading", { name: "Новый заказ" })).toBeVisible();

  const geometry = await page.evaluate(() => {
    const sidebarRect = document.querySelector(".desktop-sidebar")?.getBoundingClientRect();
    const formRect = document.querySelector(".gruzli-create-job-screen")?.getBoundingClientRect();
    return {
      sidebarRight: sidebarRect?.right ?? 0,
      formLeft: formRect?.left ?? 0,
      formPosition: formRect ? getComputedStyle(document.querySelector(".gruzli-create-job-screen")!).position : "",
      formWidth: formRect?.width ?? 0,
      viewportWidth: window.innerWidth,
    };
  });

  expect(geometry.formPosition).not.toBe("fixed");
  expect(geometry.formWidth).toBeLessThanOrEqual(861);
  expect(geometry.formLeft).toBeGreaterThanOrEqual(geometry.sidebarRight - 1);
  expect(geometry.formLeft).toBeLessThan(geometry.viewportWidth);
});


test("Compact desktop navigation keeps icon-only actions accessible", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("gruzli_demo_worker", "1");
    localStorage.setItem("gruzli_demo_role", "worker");
    localStorage.setItem("onboarding_completed", "1");
  });

  await page.goto("/");
  const feedButton = page.getByRole("button", { name: "Лента" });
  const chatsButton = page.getByRole("button", { name: "Сообщения" });

  await expect(feedButton).toBeVisible();
  await expect(chatsButton).toBeVisible();
  await expect(feedButton).toHaveAttribute("title", "Лента");
  await expect(chatsButton).toHaveAttribute("title", "Сообщения");
});


test("Desktop chat list opens a conversation with the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("gruzli_demo_worker", "1");
    localStorage.setItem("gruzli_demo_role", "worker");
    localStorage.setItem("onboarding_completed", "1");
  });

  await page.goto("/");
  await page.locator(".desktop-sidebar").getByRole("button", { name: "Сообщения" }).click();

  const conversation = page.getByRole("button", { name: "Открыть чат: Анна Петрова" });
  await expect(conversation).toBeVisible();
  await conversation.focus();
  await conversation.press("Enter");
  await expect(page.locator(".desktop-detail")).toBeVisible();
});

for (const viewport of [
  { width: 320, height: 740 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`Gruzli mobile navigation fits safely at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      localStorage.setItem("gruzli_demo_worker", "1");
      localStorage.setItem("gruzli_demo_role", "worker");
      localStorage.setItem("onboarding_completed", "1");
    });

    await page.goto("/");
    const navigation = page.locator(".bottom-nav-wrapper");
    const pill = page.locator(".bottom-nav-pill");
    await expect(navigation).toBeVisible();
    await expect(pill).toBeVisible();

    const geometry = await page.evaluate(() => {
      const nav = document.querySelector(".bottom-nav-wrapper")?.getBoundingClientRect();
      const buttons = [...document.querySelectorAll<HTMLButtonElement>(".bottom-nav-pill button")];
      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        navLeft: nav?.left ?? 0,
        navRight: nav?.right ?? 0,
        navBottom: nav?.bottom ?? 0,
        viewportHeight: window.innerHeight,
        buttonWidths: buttons.map((button) => button.getBoundingClientRect().width),
        buttonHeights: buttons.map((button) => button.getBoundingClientRect().height),
      };
    });

    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.navLeft).toBeGreaterThanOrEqual(-1);
    expect(geometry.navRight).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.navBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
    expect(geometry.buttonWidths.every((width) => width >= 44)).toBe(true);
    expect(geometry.buttonHeights.every((height) => height >= 44)).toBe(true);
  });
}
