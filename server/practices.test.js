/* @vitest-environment node */
import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { createApp } from "./index.js";

let db;

afterEach(() => {
  if (db) {
    db.close();
    db = undefined;
  }
});

describe("practices API", () => {
  it("returns seeded practices", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    const res = await request(app).get("/api/practices");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(25);
  });
});
