/* @vitest-environment node */
import { describe, it, expect, afterEach, vi } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { createApp } from "./index.js";

let db;

afterEach(() => {
  vi.restoreAllMocks();
  if (db) {
    db.close();
    db = undefined;
  }
});

describe("daily habits API", () => {
  it("returns Hicks-style habits text when Ollama succeeds", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    db.prepare("INSERT INTO notes (title, body, note_type) VALUES (?, ?, ?)").run(
      "Morning",
      "feeling scattered but hopeful",
      "general"
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: { content: "1. Breathe gently.\n2. Reach for ease." } }),
      }))
    );

    const res = await request(app)
      .post("/api/daily-habits/generate")
      .send({ includeNotes: true, notesLimit: 3 });

    expect(res.status).toBe(200);
    expect(res.body.content).toContain("Breathe");

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
    expect(body.messages[0].role).toBe("system");
    expect(String(body.messages[0].content)).toContain("Abraham Hicks");
    expect(body.messages[1].role).toBe("user");
    expect(String(body.messages[1].content)).toContain("Morning");
  });

  it("omits note text when includeNotes is false", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    db.prepare("INSERT INTO notes (title, body) VALUES (?, ?)").run("Secret", "private thought");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: { content: "ok" } }),
      }))
    );

    await request(app).post("/api/daily-habits/generate").send({ includeNotes: false });

    const userMsg = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body).messages[1].content;
    expect(String(userMsg)).not.toContain("Secret");
    expect(String(userMsg)).not.toContain("private thought");
  });
});
