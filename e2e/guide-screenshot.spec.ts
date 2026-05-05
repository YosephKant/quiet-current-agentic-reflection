import { test } from "@playwright/test";
import path from "path";

/**
 * Captures the Guide tab for visual comparison against design-reference/guide-ai-page.png.
 * Output: test-results/guide-actual.png (commit or diff locally as needed).
 */
test("screenshot: Guide page desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?tab=chat");
  await page.waitForSelector(".qc-guide-workspace", { timeout: 30_000 });
  const out = path.join("test-results", "guide-actual.png");
  await page.screenshot({ path: out, fullPage: true });
});
