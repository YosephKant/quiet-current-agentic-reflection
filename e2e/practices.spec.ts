import { test, expect } from "@playwright/test";

test.describe("Practice library run flow", () => {
  test("opens run modal from hero Start practice and can exit", async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 900 });
    await page.goto("/?tab=practices");

    await expect(page.getByRole("heading", { name: "Short practices" })).toBeVisible();
    await expect(page.locator("#practice-now-title")).toBeVisible({ timeout: 15_000 });

    await page
      .locator(".practice-now-hero")
      .getByRole("button", { name: "Start practice", exact: true })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#prun-title")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /minute reset/i })).toBeVisible();

    await dialog.getByRole("button", { name: "Close practice" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("starts timed run from grid card and reaches completion UI", async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 900 });
    await page.goto("/?tab=practices");

    await expect(page.locator(".practice-grid .practice-card").first()).toBeVisible({ timeout: 15_000 });

    const firstCard = page.locator(".practice-grid .practice-card").first();
    await firstCard.getByRole("button", { name: "Start", exact: true }).click();

    const dialog = page.getByRole("dialog").filter({ has: page.getByText("Short practice") }).first();
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: /minute reset/i }).click();
    await expect(page.getByRole("dialog", { name: "Practice player" })).toBeVisible();
    await expect(page.getByText("In practice")).toBeVisible();

    await page.getByRole("button", { name: "End", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Practice complete" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /showed up/i })).toBeVisible();

    await page.getByRole("button", { name: "Close without saving" }).click();
    await expect(page.getByRole("dialog", { name: "Practice complete" })).toBeHidden();
  });
});
