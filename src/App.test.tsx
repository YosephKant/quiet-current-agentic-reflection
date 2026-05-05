import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import App from "./App";

describe("App", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith("/api/activity/visit") || url.includes("/api/activity/visit")) {
          return new Response(JSON.stringify({ ok: true, skipped: true, streak: 0 }), { status: 200 });
        }
        if (url.startsWith("/api/home") || url.includes("/api/home")) {
          return new Response(
            JSON.stringify({
              intention: "",
              statsOptIn: false,
              streak: 0,
              lastNote: null,
              lastSession: { id: 1, title: "Hi", updated_at: "" },
              suggestedPractice: { id: 1, title: "Breathe", summary: "…", category: "samatha" },
              gratitudeCount: 0,
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        if (url.endsWith("/api/notes") && !url.includes("?")) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.endsWith("/api/chat/config")) {
          return new Response(
            JSON.stringify({ mode: "ollama", model: "llama3.1", ollamaUrl: "http://127.0.0.1:11434" }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          );
        }
        if (url.includes("/api/chat/messages")) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes("/api/chat/sessions") && !/\/api\/chat\/sessions\/\d+/.test(url)) {
          return new Response(
            JSON.stringify([
              {
                id: 1,
                title: "New chat",
                created_at: "",
                updated_at: "",
                message_count: 0,
              },
            ]),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          );
        }
        if (url.includes("/api/practices")) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.endsWith("/api/agents") || url.includes("/api/agents")) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response("not found", { status: 404 });
      })
    );
  });

  it("renders app shell and Home tab", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /Quiet Current/i })).toBeInTheDocument();
    const mainNav = screen.getByRole("navigation", { name: "Main" });
    expect(within(mainNav).getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(within(mainNav).getByRole("button", { name: "Journal" })).toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
