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

describe("notes API", () => {
  it("supports GET/POST/PATCH/DELETE", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    const listBefore = await request(app).get("/api/notes");
    expect(listBefore.status).toBe(200);
    expect(listBefore.body).toEqual([]);

    const created = await request(app).post("/api/notes").send({ title: "First", body: "Body text" });
    expect(created.status).toBe(201);
    expect(created.body.title).toBe("First");
    expect(created.body.body).toBe("Body text");
    const id = created.body.id;

    const patched = await request(app).patch(`/api/notes/${id}`).send({ title: "Updated", body: "Updated body" });
    expect(patched.status).toBe(200);
    expect(patched.body.title).toBe("Updated");
    expect(patched.body.body).toBe("Updated body");

    const listAfter = await request(app).get("/api/notes");
    expect(listAfter.status).toBe(200);
    expect(listAfter.body.length).toBe(1);
    expect(listAfter.body[0].id).toBe(id);
    expect(listAfter.body[0].title).toBe("Updated");

    const deleted = await request(app).delete(`/api/notes/${id}`);
    expect(deleted.status).toBe(204);

    const listFinal = await request(app).get("/api/notes");
    expect(listFinal.status).toBe(200);
    expect(listFinal.body).toEqual([]);
  });
});

describe("notes search and provenance", () => {
  it("supports ?q= full-text search and stores source session", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    const a = await request(app).post("/api/notes").send({ title: "A", body: "uniquekeywordxyz calm breath" });
    expect(a.status).toBe(201);
    const b = await request(app)
      .post("/api/notes")
      .send({ title: "B", body: "other" });
    expect(b.status).toBe(201);

    const s = await request(app).get("/api/chat/sessions");
    const sid = s.body[0].id;

    const c = await request(app).post("/api/notes").send({
      title: "From chat",
      body: "q",
      sourceSessionId: sid,
      noteType: "gratitude",
    });
    expect(c.status).toBe(201);
    expect(c.body.source_session_id).toBe(sid);
    expect(c.body.note_type).toBe("gratitude");

    const search = await request(app).get("/api/notes?q=uniquekeywordxyz");
    expect(search.status).toBe(200);
    expect(Array.isArray(search.body)).toBe(true);
    expect(search.body.some((n) => String(n.body).includes("uniquekeywordxyz"))).toBe(true);
  });
});

describe("notes title generation", () => {
  it("auto-generates a title when blank", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: { content: "A Softer Morning Plan" } }),
      }))
    );

    const created = await request(app)
      .post("/api/notes")
      .send({ title: "", body: "I want to breathe and keep the day simple." });

    expect(created.status).toBe(201);
    expect(created.body.title).toBe("A Softer Morning Plan");
  });
});
