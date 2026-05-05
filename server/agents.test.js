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

describe("custom agents API", () => {
  it("creates, lists, updates, deletes agents", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    const empty = await request(app).get("/api/agents");
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual([]);

    const bad = await request(app).post("/api/agents").send({ name: "x" });
    expect(bad.status).toBe(400);

    const cre = await request(app)
      .post("/api/agents")
      .send({ name: " Anchor ", systemPrompt: " Be brief. " });
    expect(cre.status).toBe(201);
    expect(cre.body.name).toBe("Anchor");
    expect(cre.body.system_prompt).toContain("brief");

    const list = await request(app).get("/api/agents");
    expect(list.body.length).toBe(1);
    const id = list.body[0].id;

    const patch = await request(app)
      .patch(`/api/agents/${id}`)
      .send({ systemPrompt: "Even shorter replies." });
    expect(patch.status).toBe(200);
    expect(patch.body.system_prompt).toContain("shorter");

    const del = await request(app).delete(`/api/agents/${id}`);
    expect(del.status).toBe(204);
    const again = await request(app).get("/api/agents");
    expect(again.body.length).toBe(0);
  });

  it("returns assistant text for agent chat when upstream succeeds", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: { content: "hello from persona" } }),
      }))
    );

    const ins = db
      .prepare("INSERT INTO custom_agents (name, system_prompt) VALUES (?, ?) RETURNING id")
      .get("Test", "Just acknowledge calmly.");

    const res = await request(app)
      .post("/api/agents/chat")
      .send({
        agentId: ins.id,
        messages: [{ role: "user", content: "hi" }],
      });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe("assistant");
    expect(res.body.content).toBe("hello from persona");

    const fetchCallBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
    expect(fetchCallBody.messages[0].role).toBe("system");
    expect(fetchCallBody.messages[0].content).toContain("Just acknowledge calmly");
    expect(fetchCallBody.messages[0].content).toContain("Do not provide medical");
  });

  it("accepts request-scoped systemPrompt without agent id", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: { content: "draft ok" } }),
      }))
    );

    const res = await request(app)
      .post("/api/agents/chat")
      .send({
        messages: [{ role: "user", content: "ping" }],
        systemPrompt: "One word answers.",
      });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe("draft ok");
  });

  it("persists structured guide fields and uses them in preview chat", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: { content: "clarity preview" } }),
      }))
    );

    const created = await request(app)
      .post("/api/agents")
      .send({
        name: "Clarity Coach",
        shortDescription: "Sort loops into one grounded next step.",
        rolePurpose: "Encouraging mentor",
        tone: "Direct",
        speakingStyle: "Practical and direct",
        encouragementStyle: "Accountability-oriented",
        focusAreas: ["Clarity", "Focus"],
        boundaries: { avoidMedicalOrCrisisAdvice: true },
        contextAccess: {
          enabled: true,
          sources: {
            notes: true,
            gratitudes: false,
            reflections: true,
            intentions: true,
            practices: false,
            weeklyReviews: false,
            guideChats: false,
          },
          recencyWindowDays: 14,
        },
        behaviorTuning: {
          softnessDirectness: 85,
          reflectiveAction: 80,
          sparseExpansive: 25,
          groundingReframing: 65,
        },
        customInstructions: "Use concise structure.",
        isActive: true,
      });

    expect(created.status).toBe(201);
    expect(created.body.guide.tone).toBe("Direct");
    expect(created.body.guide.focusAreas).toEqual(["Clarity", "Focus"]);
    expect(created.body.guide.contextAccess.enabled).toBe(true);
    expect(created.body.guide.contextAccess.sources.practices).toBe(false);
    expect(created.body.guide.behaviorTuning.softnessDirectness).toBe(85);
    expect(created.body.is_active).toBe(1);

    const res = await request(app)
      .post("/api/agents/chat")
      .send({
        agentId: created.body.id,
        messages: [{ role: "user", content: "I feel anxious and can't stop overthinking." }],
      });

    expect(res.status).toBe(200);
    const fetchCallBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
    const system = fetchCallBody.messages[0].content;
    expect(system).toContain("You are Clarity Coach, Encouraging mentor");
    expect(system).toContain("Tone: Direct");
    expect(system).toContain("Speaking style: Practical and direct");
    expect(system).toContain("Use concise structure");
    expect(system).toContain("Soft to direct: 85/100");
    expect(system).toContain("Do not provide medical");
  });

  it("adds local app context to preview prompt only when guide opts in", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    db.prepare("INSERT INTO notes (title, body, note_type) VALUES (?, ?, ?)").run(
      "Anxiety pattern",
      "Breathing by the window helped me slow down last night.",
      "reflection"
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: { content: "context aware" } }),
      }))
    );

    const on = await request(app)
      .post("/api/agents")
      .send({
        name: "Context Guide",
        shortDescription: "Uses permitted app history gently.",
        rolePurpose: "Reflective companion",
        contextAccess: {
          enabled: true,
          sources: {
            notes: false,
            gratitudes: false,
            reflections: true,
            intentions: false,
            practices: false,
            weeklyReviews: false,
            guideChats: false,
          },
          recencyWindowDays: 30,
        },
      });

    const off = await request(app)
      .post("/api/agents")
      .send({
        name: "Current Chat Guide",
        shortDescription: "Uses only this chat.",
        rolePurpose: "Reflective companion",
        contextAccess: { enabled: false },
      });

    await request(app)
      .post("/api/agents/chat")
      .send({
        agentId: on.body.id,
        messages: [{ role: "user", content: "I feel anxious" }],
      });
    const onPrompt = JSON.parse(vi.mocked(fetch).mock.calls.at(-1)[1].body).messages[0].content;
    expect(onPrompt).toContain("USER APP CONTEXT");
    expect(onPrompt).toContain("Breathing by the window helped me slow down");

    await request(app)
      .post("/api/agents/chat")
      .send({
        agentId: off.body.id,
        messages: [{ role: "user", content: "I feel anxious" }],
      });
    const offPrompt = JSON.parse(vi.mocked(fetch).mock.calls.at(-1)[1].body).messages[0].content;
    expect(offPrompt).not.toContain("USER APP CONTEXT");
    expect(offPrompt).not.toContain("Breathing by the window");
  });

  it("returns a calm persona fallback when preview model is unavailable", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    const res = await request(app)
      .post("/api/agents/chat")
      .send({
        name: "Evening Unwind",
        rolePurpose: "Soothing companion",
        tone: "Warm",
        speakingStyle: "Reflective and spacious",
        messages: [{ role: "user", content: "I feel anxious and can't stop overthinking." }],
      });

    expect(res.status).toBe(200);
    expect(res.body.fallback).toBe(true);
    expect(res.body.content).toContain("Evening Unwind");
    expect(res.body.error).toBeUndefined();
  });

  it("returns 400 when agent chat missing persona context", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    const res = await request(app)
      .post("/api/agents/chat")
      .send({
        messages: [{ role: "user", content: "ping" }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/agentId|systemPrompt/i);
  });
});
