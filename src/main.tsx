import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/guide-premium.css";

const el = document.getElementById("root");
if (el) {
  createRoot(el).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // non-fatal when registration fails
      });
    });
  } else {
    // In dev, always remove SW to avoid stale cached UI.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => {
        void r.unregister();
      });
    });
  }
}
