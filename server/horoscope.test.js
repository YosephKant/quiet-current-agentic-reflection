/* @vitest-environment node */
import { describe, it, expect, afterEach, vi } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { createApp } from "./index.js";
import {
  tropicalSunSignFromMonthDay,
  lunarSkyFromJulianDay,
  julianDayUtc,
} from "./horoscope.js";

let db;

afterEach(() => {
  vi.restoreAllMocks();
  if (db) {
    db.close();
    db = undefined;
  }
});

describe("horoscope astronomy helpers", () => {
  it("maps tropical sun sign for known calendar dates", () => {
    expect(tropicalSunSignFromMonthDay(7, 15)).toBe("Cancer");
    expect(tropicalSunSignFromMonthDay(3, 25)).toBe("Aries");
    expect(tropicalSunSignFromMonthDay(1, 10)).toBe("Capricorn");
    expect(tropicalSunSignFromMonthDay(12, 25)).toBe("Capricorn");
  });

  it("keeps moon illumination between 0 and 100", () => {
    const samples = [
      new Date(Date.UTC(2024, 0, 11, 12, 0, 0)),
      new Date(Date.UTC(2026, 4, 1, 8, 30, 0)),
      new Date(Date.UTC(2000, 0, 6, 18, 0, 0)),
    ];
    for (const d of samples) {
      const jd = julianDayUtc(d);
      const sky = lunarSkyFromJulianDay(jd);
      expect(sky.moonIlluminationPercent).toBeGreaterThanOrEqual(0);
      expect(sky.moonIlluminationPercent).toBeLessThanOrEqual(100);
      expect(typeof sky.moonPhaseLabel).toBe("string");
      expect(sky.moonPhaseLabel.length).toBeGreaterThan(2);
    }
  });
});

describe("POST /api/horoscope/daily", () => {
  it("returns 400 without birthDate", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    const res = await request(app).post("/api/horoscope/daily").send({});
    expect(res.status).toBe(400);
  });

  it("returns 200 with expected keys (AI stubbed)", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              love: ["a", "b", "c"],
              career: ["d", "e", "f"],
              personal: ["g", "h", "i"],
              closing: "Soft light through thin clouds.",
              disclaimerHint: "Just for fun.",
            }),
          },
        }),
      }))
    );

    const res = await request(app)
      .post("/api/horoscope/daily")
      .send({ birthDate: "1990-07-15", birthPlace: "Portland" });

    expect(res.status).toBe(200);
    expect(res.body.sunSign).toBe("Cancer");
    expect(typeof res.body.moonSignApprox).toBe("string");
    expect(typeof res.body.moonPhase).toBe("string");
    expect(typeof res.body.moonIlluminationPercent).toBe("number");
    expect(Array.isArray(res.body.love)).toBe(true);
    expect(Array.isArray(res.body.career)).toBe(true);
    expect(Array.isArray(res.body.personal)).toBe(true);
    expect(res.body.love).toHaveLength(3);
    expect(typeof res.body.closing).toBe("string");
    expect(typeof res.body.disclaimerHint).toBe("string");
    expect(res.body.fallback).toBe(false);
  });

  it("returns 200 with fallback when AI JSON missing", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          message: { content: "not json" },
        }),
      }))
    );

    const res = await request(app).post("/api/horoscope/daily").send({ birthDate: "1990-03-25" });
    expect(res.status).toBe(200);
    expect(res.body.sunSign).toBe("Aries");
    expect(res.body.fallback).toBe(true);
    expect(res.body.love.length).toBe(3);
  });
});
