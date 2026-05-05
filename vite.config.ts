import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/** Browser calls use relative `/api/...`. Dev + preview forward here — default matches `PORT` in server/index.js (3001). Set `API_PROXY_TARGET` in the environment or `.env.local` if another process owns 3001. */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget =
    env.API_PROXY_TARGET || process.env.API_PROXY_TARGET || "http://127.0.0.1:3001";

  const apiProxy = {
    "/api": {
      target: apiTarget,
      changeOrigin: true,
    },
  } as const;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { ...apiProxy },
      // Windows: installer staging can be transient / locked; watching it has crashed Vite (UNKNOWN scandir/lstat).
      watch: {
        ignored: ["**/installer/**", "**/installer"],
      },
    },
    /** `vite preview` uses this too (Vite also falls back to server.proxy when preview.proxy is unset). */
    preview: {
      proxy: { ...apiProxy },
    },
  };
});
