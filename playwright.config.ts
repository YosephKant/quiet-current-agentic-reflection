import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:5274",
    trace: "on-first-retry",
  },
  webServer: {
    command:
      process.platform === "win32"
        ? "cmd /c \"set PORT=3201&& set API_PROXY_TARGET=http://127.0.0.1:3201&& npm run dev:e2e\""
        : "PORT=3201 API_PROXY_TARGET=http://127.0.0.1:3201 npm run dev:e2e",
    url: "http://127.0.0.1:5274",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
