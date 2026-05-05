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

describe("insights + teacher endpoints", () => {
  it("returns insights content", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    db.prepare("INSERT INTO notes (title, body) VALUES (?, ?)").run("x", "I want more calm.");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: { content: "Core themes\n- Calm" } }),
      }))
    );

    const res = await request(app).post("/api/insights/generate").send({});
    expect(res.status).toBe(200);
    expect(String(res.body.content)).toContain("Core themes");
  });

  it("returns teacher recommendation and exposes teacher list", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    db.prepare("INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)").run(
      1,
      "user",
      "I want to be present and breathe."
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              teacher: "Eckhart Tolle",
              why: "Presence-focused language.",
              guidance: "Return to now.",
              mantra: "Now is enough.",
            }),
          },
        }),
      }))
    );

    const rec = await request(app).post("/api/teachers/recommend").send({});
    expect(rec.status).toBe(200);
    expect(rec.body.teacher).toBe("Eckhart Tolle");
    expect(typeof rec.body.teacherListSize).toBe("number");
    expect(rec.body.teacherListSize).toBeGreaterThanOrEqual(50);

    const list = await request(app).get("/api/teachers");
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.length).toBe(rec.body.teacherListSize);
  });

  it("teacher recommend accepts a model-chosen name outside the browse list", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              teacher: "Oliver Burkeman (anti-urgency)",
              why: "Fits hurry and never-done feelings.",
              guidance: "Try smaller horizons.",
              mantra: "Enough for today.",
            }),
          },
        }),
      }))
    );

    const rec = await request(app).post("/api/teachers/recommend").send({});
    expect(rec.status).toBe(200);
    expect(rec.body.fallback).toBeFalsy();
    expect(rec.body.teacher).toBe("Oliver Burkeman (anti-urgency)");
  });
});

