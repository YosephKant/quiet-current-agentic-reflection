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

describe("POST /api/ambience/generate", () => {
  it("returns 400 without mood", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    const res = await request(app).post("/api/ambience/generate").send({});
    expect(res.status).toBe(400);
  });

  it("returns spec with layers when AI returns valid JSON", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              title: "Test patch",
              description: "Soft test tones.",
              layers: [
                { waveform: "sine", frequencyHz: 100, detuneCents: -2, gain: 0.05 },
                { waveform: "triangle", frequencyHz: 150, detuneCents: 1, gain: 0.04 },
                { waveform: "sine", frequencyHz: 200, detuneCents: 0, gain: 0.035 },
              ],
              lowpassHz: 900,
              lowpassQ: 0.8,
              masterPeak: 0.18,
              swellSeconds: 4,
              filterSweepToHz: 1200,
            }),
          },
        }),
      }))
    );

    const res = await request(app).post("/api/ambience/generate").send({ mood: "calm evening" });
    expect(res.status).toBe(200);
    expect(res.body.spec).toBeTruthy();
    expect(res.body.spec.title.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.spec.layers)).toBe(true);
    expect(res.body.spec.layers.length).toBeGreaterThanOrEqual(2);
    expect(res.body.fallback).toBe(false);
  });

  it("returns fallback template when model output is not JSON", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          message: { content: "here is some prose without json" },
        }),
      }))
    );

    const res = await request(app).post("/api/ambience/generate").send({ mood: "anxious and wired" });
    expect(res.status).toBe(200);
    expect(res.body.fallback).toBe(true);
    expect(res.body.spec.layers.length).toBeGreaterThanOrEqual(2);
  });
});
