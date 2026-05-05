import { test, expect, type Page, type Route } from "@playwright/test";

/** Same stubs as smoke.spec.ts — avoids flaky LLM routes if other tabs prefetch. */
async function stubChatAndHabits(page: Page) {
  const mockChat = async (route: Route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        role: "assistant",
        content: "hi from mocked chat",
        suggestions: [],
      }),
    });
  };
  const mockHabits = async (route: Route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        content: "1. Reach for ease.\n2. Appreciate one small win today.",
      }),
    });
  };
  await page.route(/\/api\/chat$/, mockChat);
  await page.route(/\/api\/daily-habits\/generate$/, mockHabits);
}

async function createNoteAndAssertInList(page: Page) {
  await expect(page.getByRole("heading", { name: "Journal", exact: true })).toBeVisible();

  await page
    .getByRole("region", { name: "Journal editor" })
    .getByRole("button", { name: "New note", exact: true })
    .click();

  const titleValue = `E2E journal ${Date.now()}`;
  await page.locator("#note-title").fill(titleValue);
  await page.locator("#note-body").fill("Created by Playwright journal E2E — save path.");
  await page.getByTestId("jn-save").click();

  await expect(page.locator(".jn-note-row").filter({ hasText: titleValue })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#note-body")).toHaveValue(/journal E2E/);
}

test.describe("Journal / Notes tab", () => {
  test.beforeEach(async ({ page }) => {
    await stubChatAndHabits(page);
  });

  test("desktop: Main sidebar opens Journal, create and save updates list", async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible();

    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("button", { name: "Journal", exact: true })
      .click();

    await createNoteAndAssertInList(page);
  });

  test("mobile: Primary bottom nav opens Journal, create and save", async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible();

    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("button", { name: "Journal", exact: true })
      .click();

    await createNoteAndAssertInList(page);
  });

  test("deep link ?tab=notes shows Journal heading and save flow (desktop)", async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 900 });
    await page.goto("/?tab=notes");
    await expect(page.getByRole("main")).toBeVisible();

    await createNoteAndAssertInList(page);
  });
});
