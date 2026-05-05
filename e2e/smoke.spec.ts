import { test, expect } from "@playwright/test";

test("smoke: app loads, practices/notes/chat flows", async ({ page }) => {
  const mockChat = async (route) => {
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
  const mockHabits = async (route) => {
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

  // Shell hides bottom nav above 959px; "More" lives only in mobile chrome.
  await page.setViewportSize({ width: 430, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("region", { name: "Today" })).toBeVisible();

  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page.locator("#practice-now-title")).toHaveText("Sitting without a goal");

  await page.getByRole("button", { name: "Journal", exact: true }).click();
  await page
    .getByRole("region", { name: "Journal editor" })
    .getByRole("button", { name: "New note", exact: true })
    .click();

  const titleValue = `E2E note ${Date.now()}`;
  await page.locator("#note-title").fill(titleValue);
  await page.locator("#note-body").fill("Created by Playwright smoke test");
  await page.getByTestId("jn-save").click();
  await expect(page.locator(".jn-note-row").filter({ hasText: titleValue })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Guide", exact: true }).click();
  await page.locator("#chat-input").fill("hello");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("hi from mocked chat")).toBeVisible();

  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("button", { name: "Daily rhythm" }).click();
  await page.getByRole("button", { name: "Generate new" }).click();
  await expect(page.getByText("Reach for ease")).toBeVisible();
});
