import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    pool: "forks",
    globals: true,
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    include: ["src/**/*.test.{ts,tsx}", "server/**/*.test.{js,ts}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
