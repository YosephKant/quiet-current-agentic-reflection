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

describe("chat API", () => {
  it("returns assistant text when upstream succeeds", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: { content: "hi" } }),
      }))
    );

    const res = await request(app)
      .post("/api/chat")
      .send({ sessionId: 1, messages: [{ role: "user", content: "breath" }] });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe("assistant");
    expect(res.body.content).toBe("hi");

    const stored = db
      .prepare("SELECT role, content, session_id FROM chat_messages ORDER BY id ASC")
      .all();
    expect(stored.length).toBe(2);
    expect(stored[0].role).toBe("user");
    expect(stored[0].content).toBe("breath");
    expect(stored[0].session_id).toBe(1);
    expect(stored[1].role).toBe("assistant");
    expect(stored[1].content).toBe("hi");

    const fetchCallBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
    expect(fetchCallBody.messages[0].role).toBe("system");
    expect(fetchCallBody.messages[0].content).toContain("Alan Watts-inspired");
  });

  it("uses optional systemPrompt override in system message", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: { content: "custom-voice" } }),
      }))
    );

    const custom = "You are a stoic lighthouse keeper who speaks in short nautical metaphors.";
    const res = await request(app).post("/api/chat").send({
      sessionId: 1,
      systemPrompt: custom,
      messages: [{ role: "user", content: "hello" }],
    });

    expect(res.status).toBe(200);
    const fetchCallBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
    expect(fetchCallBody.messages[0].content).toContain(custom);
    expect(fetchCallBody.messages[0].content).not.toContain("Alan Watts-inspired");
  });

  it("returns 502 with hint when upstream fails", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    const res = await request(app)
      .post("/api/chat")
      .send({ sessionId: 1, messages: [{ role: "user", content: "hello" }] });

    expect(res.status).toBe(502);
    expect(res.body.error).toContain("network down");
    expect(res.body.hint).toContain("Ollama");
  });

  it("alternates to Abraham Hicks persona on next assistant turn", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: { content: "hi again" } }),
      }))
    );

    const res = await request(app)
      .post("/api/chat")
      .send({
        sessionId: 1,
        messages: [
          { role: "user", content: "hello" },
          { role: "assistant", content: "prior response" },
          { role: "user", content: "continue" },
        ],
      });

    expect(res.status).toBe(200);
    const fetchCallBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
    expect(fetchCallBody.messages[0].content).toContain("Abraham Hicks-inspired");
  });

  it("GET /api/chat/messages returns persisted rows", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: { content: "saved" } }),
      }))
    );

    await request(app)
      .post("/api/chat")
      .send({ sessionId: 1, messages: [{ role: "user", content: "breath" }] });

    const res = await request(app).get("/api/chat/messages?sessionId=1");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0].content).toBe("breath");
    expect(res.body[1].content).toBe("saved");
  });

  it("does not return video suggestions", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: { content: "ok" } }),
      }))
    );

    const res = await request(app)
      .post("/api/chat")
      .send({
        sessionId: 1,
        messages: [
          { role: "user", content: "breath practice?" },
          { role: "assistant", content: "response" },
          { role: "user", content: "what about my calendar for next week" },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.suggestions).toBeUndefined();
  });

  it("uses stored agent system prompt when agentId is sent", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    const row = db
      .prepare("INSERT INTO custom_agents (name, system_prompt) VALUES (?, ?) RETURNING id")
      .get("Tester", "SPECIAL_AGENT_MARKER");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: { content: "ok" } }),
      }))
    );

    const res = await request(app)
      .post("/api/chat")
      .send({
        sessionId: 1,
        agentId: row.id,
        messages: [{ role: "user", content: "hi" }],
      });

    expect(res.status).toBe(200);
    const fetchCallBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
    expect(fetchCallBody.messages[0].content).toContain("SPECIAL_AGENT_MARKER");
    expect(fetchCallBody.messages[0].content).not.toContain("Alan Watts-inspired");
  });

  it("uses structured active guide prompt when agentId is sent to main Guide chat", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    const create = await request(app)
      .post("/api/agents")
      .send({
        name: "Evening Unwind",
        shortDescription: "A slow guide for letting the day settle.",
        rolePurpose: "Soothing companion",
        tone: "Warm",
        speakingStyle: "Reflective and spacious",
        encouragementStyle: "Minimal reassurance",
        focusAreas: ["Rest", "Overthinking"],
        customInstructions: "Move slowly and avoid productivity framing.",
        isActive: true,
      });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: { content: "rest response" } }),
      }))
    );

    const res = await request(app)
      .post("/api/chat")
      .send({
        sessionId: 1,
        agentId: create.body.id,
        personaName: "Evening Unwind",
        personaKey: "srv:" + create.body.id,
        personaSource: "server",
        messages: [{ role: "user", content: "I feel anxious and can't stop overthinking." }],
      });

    expect(res.status).toBe(200);
    const fetchCallBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
    const system = fetchCallBody.messages[0].content;
    expect(system).toContain("You are Evening Unwind, Soothing companion");
    expect(system).toContain("Tone: Warm");
    expect(system).toContain("Rest, Overthinking");
    expect(system).toContain("Move slowly");
    expect(system).not.toContain("Alan Watts-inspired");
  });
});
