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

describe("weekly review + generated practice API", () => {
  it("generates a weekly review payload", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    db.prepare("INSERT INTO notes (title, body) VALUES (?, ?)").run("Week note", "I handled stress better.");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              hero: "This week asked for steadiness over force. You returned to short practices and honest notes.",
              whatStoodOut: ["Small anchors helped you notice patterns."],
              whatSupportedYou: ["Brief check-ins created space."],
              carryForward: ["Keep one morning intention line."],
              smallNextStep: "Choose one 10-minute practice this week.",
            }),
          },
        }),
      }))
    );

    const res = await request(app).post("/api/weekly-review/generate").send({});
    expect(res.status).toBe(200);
    expect(res.body.review.hero).toContain("steadiness over force");
    expect(res.body.review.whatStoodOut).toEqual(["Small anchors helped you notice patterns."]);
    expect(String(res.body.content)).toContain("smallNextStep");
    expect(res.body.stats.noteCount).toBeGreaterThanOrEqual(1);
  });

  it("falls back to structured privacy-safe JSON when weekly review markdown is returned", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          message: {
            content:
              "**Weekly review**\n- This includes a relationship conflict and private health detail.\n\nPatterns I noticed\n- - Raw markdown.",
          },
        }),
      }))
    );

    const res = await request(app).post("/api/weekly-review/generate").send({});
    expect(res.status).toBe(200);
    expect(res.body.fallback).toBe(true);
    expect(res.body.review.hero).not.toMatch(/relationship|health/i);
    expect(Array.isArray(res.body.review.whatStoodOut)).toBe(true);
  });

  it("creates a new practice from chat session context", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    db.prepare("INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)").run(
      1,
      "user",
      "I need a 5-minute calming breath reset before work."
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              title: "Morning Breath Reset",
              summary: "Sit upright and exhale longer than inhale for five minutes.",
              category: "breathwork",
              tags: ["breath", "short"],
              est_minutes: 5,
            }),
          },
        }),
      }))
    );

    const res = await request(app).post("/api/practices/generate-from-chat").send({ sessionId: 1 });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Morning Breath Reset");
    expect(Array.isArray(res.body.tags)).toBe(true);
    expect(res.body.tags).toContain("generated");
    expect(res.body.est_minutes).toBe(5);
  });
});

