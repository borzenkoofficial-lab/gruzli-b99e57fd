import { test, expect } from "@playwright/test";

test("Gruzli loads without a fatal application error", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Gruzli");
  await expect(page.locator("#root")).not.toBeEmpty();
});

test("mobile shell does not introduce horizontal document overflow on first load", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});
