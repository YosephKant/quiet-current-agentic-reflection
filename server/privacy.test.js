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

describe("privacy endpoints", () => {
  it("exports and deletes all local data", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: { content: "hi" } }),
      }))
    );

    await request(app).post("/api/notes").send({ title: "A", body: "B" });
    await request(app).post("/api/chat").send({ sessionId: 1, messages: [{ role: "user", content: "hello" }] });

    const exp = await request(app).get("/api/privacy/export");
    expect(exp.status).toBe(200);
    expect(Array.isArray(exp.body.notes)).toBe(true);
    expect(Array.isArray(exp.body.chat_sessions)).toBe(true);

    const del = await request(app).delete("/api/privacy/delete-all-data");
    expect(del.status).toBe(204);

    const after = await request(app).get("/api/privacy/export");
    expect(after.body.notes.length).toBe(0);
    expect(after.body.chat_messages.length).toBe(0);
    expect(after.body.chat_sessions.length).toBe(1);
  });
});

