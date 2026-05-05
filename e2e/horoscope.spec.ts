import { test, expect, type Page, type Route } from "@playwright/test";

const mockHoroscopeDaily = async (route: Route) => {
  if (route.request().method() !== "POST") {
    await route.continue();
    return;
  }
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      sunSign: "Cancer",
      moonSignApprox: "Gemini",
      moonPhase: "Waxing crescent",
      moonIlluminationPercent: 22,
      love: ["E2E love guidance line one.", "Two.", "Three."],
      career: ["E2E career guidance line one.", "Two.", "Three."],
      personal: ["E2E personal growth line one.", "Two.", "Three."],
      closing: "Soft light through thin clouds.",
      disclaimerHint: "For entertainment only — not a forecast of outcomes.",
      fallback: false,
    }),
  });
};

async function dismissOptionalBanner(page: Page) {
  const candidates = [
    page.getByRole("button", { name: /^dismiss$/i }),
    page.getByRole("button", { name: /close.*notice|dismiss.*banner|got it|not now/i }),
  ];
  for (const loc of candidates) {
    if (await loc.first().isVisible().catch(() => false)) {
      await loc.first().click();
      break;
    }
  }
}

test.describe("Horoscope tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\/api\/horoscope\/daily$/, mockHoroscopeDaily);
  });

  test("desktop: sidebar nav, form, reading, snapshot and guidance columns", async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible();

    await dismissOptionalBanner(page);

    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Horoscope", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Horoscope", exact: true })).toBeVisible();
    await expect(page.getByText(/symbolic reading for today/i)).toBeVisible();
    await expect(page.locator(".qc-page-subtitle").getByText(/entertainment/i)).toBeVisible();

    const birthDate = page.locator("#horoscope-birth-date");
    await expect(birthDate).toBeVisible();
    await birthDate.fill("1990-07-15");

    await page.getByRole("button", { name: /Get today.s reading/i }).click();

    await expect(page.getByRole("region", { name: "Sky snapshot" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("E2E love guidance line one.")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("E2E career guidance line one.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Personal growth", exact: true })).toBeVisible();

    const ambience = page.getByRole("switch", { name: /ambience on|ambience off/i });
    await expect(ambience).toBeVisible();
    await expect(ambience).toHaveAttribute("aria-checked", "false");
    await ambience.click();
    await expect(ambience).toHaveAttribute("aria-checked", "true");
  });

  test("mobile: More drawer to Horoscope, date fill triggers reading", async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible();

    await dismissOptionalBanner(page);

    await page.getByRole("button", { name: "More", exact: true }).click();
    const drawer = page.getByRole("dialog", { name: "More" });
    await expect(drawer).toBeVisible();
    await drawer.getByRole("button", { name: "Horoscope", exact: true }).click();
    await expect(drawer).toHaveCount(0);

    await expect(page.getByRole("heading", { name: "Horoscope", exact: true })).toBeVisible();

    await page.locator("#horoscope-birth-date").fill("2000-01-10");
    await page.getByRole("button", { name: /Get today.s reading/i }).click();

    await expect(page.getByRole("region", { name: "Sky snapshot" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Love", exact: true })).toBeVisible({ timeout: 20_000 });
  });
});
