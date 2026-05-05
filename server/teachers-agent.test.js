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

const longPrompt =
  "You are a calm guide inspired by Marcus Aurelius. Stay practical. Never invent direct quotes. " +
  "Invite reflection in short paragraphs. Avoid medical advice. ".repeat(6);

/** Last user message content from an Ollama-style fetch body (matches aiProvider). */
function userContentFromFetchInit(init) {
  const raw = typeof init?.body === "string" ? init.body : "{}";
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return "";
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return String(lastUser?.content || "");
}

describe("POST /api/teachers/build-agent", () => {
  it("returns 400 when nothing to build from", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    const res = await request(app).post("/api/teachers/build-agent").send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 when fromNotes is true but there are no notes", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    const res = await request(app).post("/api/teachers/build-agent").send({ fromNotes: true });
    expect(res.status).toBe(400);
  });

  it("creates a custom agent from situation when model returns valid JSON", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              figure: "Marcus Aurelius",
              whyFit: "Stoic framing fits a decision-heavy week.",
              agentName: "Guide · Marcus Aurelius",
              systemPrompt: longPrompt,
            }),
          },
        }),
      }))
    );

    const res = await request(app)
      .post("/api/teachers/build-agent")
      .send({ situation: "I feel scattered choosing between two job offers." });

    expect(res.status).toBe(201);
    expect(res.body.figure).toBe("Marcus Aurelius");
    expect(res.body.agent?.name).toContain("Marcus");
    expect(String(res.body.agent?.system_prompt || "")).toContain("Marcus Aurelius");

    const list = await request(app).get("/api/agents");
    expect(list.body.length).toBe(1);
  });

  it("returns 201 with fallback when upstream fetch fails (e.g. Ollama unreachable)", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const res = await request(app)
      .post("/api/teachers/build-agent")
      .send({ situation: "I want steadier mornings before work." });

    expect(res.status).toBe(201);
    expect(res.body.fallback).toBe(true);
    expect(res.body.reason).toBe("ai_unavailable");
    expect(res.body.agent?.id).toBeTruthy();
  });

  it("does not treat string fromNotes as true (Boolean bug)", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              figure: "Marcus Aurelius",
              whyFit: "Stoic framing fits a decision-heavy week.",
              agentName: "Guide · Marcus Aurelius",
              systemPrompt: longPrompt,
            }),
          },
        }),
      }))
    );

    const res = await request(app)
      .post("/api/teachers/build-agent")
      .send({ situation: "Choosing between two paths.", fromNotes: "false" });

    expect(res.status).toBe(201);
    expect(res.body.figure).toBe("Marcus Aurelius");
  });

  it("returns 201 when model picks a non-catalog figure with valid JSON", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              figure: "Oliver Burkeman (four thousand weeks)",
              whyFit: "Anti-urgency framing fits decision fatigue.",
              agentName: "Guide · Oliver Burkeman",
              systemPrompt: longPrompt,
            }),
          },
        }),
      }))
    );

    const res = await request(app)
      .post("/api/teachers/build-agent")
      .send({ situation: "I feel rushed by deadlines and never done." });

    expect(res.status).toBe(201);
    expect(res.body.fallback).toBe(false);
    expect(res.body.figure).toBe("Oliver Burkeman (four thousand weeks)");
    expect(res.body.agent?.name).toContain("Burkeman");
  });

  it("falls back and still creates an agent when model JSON is invalid", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: { content: "not json" } }),
      }))
    );

    const res = await request(app)
      .post("/api/teachers/build-agent")
      .send({ situation: "I want more calm and presence each morning." });

    expect(res.status).toBe(201);
    expect(res.body.fallback).toBe(true);
    expect(res.body.agent?.id).toBeTruthy();
    expect(res.body.figure).toBeTruthy();
  });

  it("Test A: habits/discipline situation surfaces mocked James Clear figure", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              figure: "James Clear",
              whyFit: "Identity-based habits fit streak-breaking and discipline struggles.",
              agentName: "Guide · James Clear",
              systemPrompt: longPrompt,
            }),
          },
        }),
      }))
    );

    const res = await request(app).post("/api/teachers/build-agent").send({
      situation:
        "I keep breaking promises to myself about morning routines and want more discipline with my habits.",
    });

    expect(res.status).toBe(201);
    expect(res.body.figure).toBe("James Clear");
  });

  it("Test B: grief/trauma regulation situation surfaces mocked Bessel van der Kolk figure", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              figure: "Bessel van der Kolk",
              whyFit: "Embodied regulation framing fits grief and trauma-heavy language.",
              agentName: "Guide · Bessel van der Kolk",
              systemPrompt: longPrompt,
            }),
          },
        }),
      }))
    );

    const res = await request(app).post("/api/teachers/build-agent").send({
      situation:
        "After a sudden loss I feel numb and dysregulated; I need support around grief and trauma regulation.",
    });

    expect(res.status).toBe(201);
    expect(res.body.figure).toBe("Bessel van der Kolk");
  });

  it("fallback: embodiment / inner-body keywords map to Tara Brach when model JSON is invalid", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: { content: "not json {{{" } }),
      }))
    );

    const res = await request(app).post("/api/teachers/build-agent").send({
      situation:
        "I want motivation for attention in my inner body, interoception, and a gentle felt sense practice.",
    });

    expect(res.status).toBe(201);
    expect(res.body.fallback).toBe(true);
    expect(res.body.figure).toBe("Tara Brach");
  });

  it("five-scenario suite: distinct mocked figures for five different situation markers", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    const plans = [
      { needle: "SCEN_ETHICAL_STOIC", figure: "Marcus Aurelius" },
      { needle: "SCEN_HABIT_ATOMIC", figure: "James Clear" },
      { needle: "SCEN_SOMATIC_RELEASE", figure: "Peter Levine" },
      { needle: "SCEN_REL_INTIMACY", figure: "Esther Perel" },
      { needle: "SCEN_TEMPORAL_PEACE", figure: "Oliver Burkeman" },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        const uc = userContentFromFetchInit(init);
        const hit = plans.find((x) => uc.includes(x.needle));
        const figure = hit?.figure ?? "James Clear";
        return {
          ok: true,
          json: async () => ({
            message: {
              content: JSON.stringify({
                figure,
                whyFit: `Mock fit line for ${figure}.`,
                agentName: `Guide · ${figure}`,
                systemPrompt: longPrompt,
              }),
            },
          }),
        };
      })
    );

    const figures = [];
    for (const p of plans) {
      const res = await request(app)
        .post("/api/teachers/build-agent")
        .send({ situation: `Context ${p.needle} — please tailor the voice.` });
      expect(res.status).toBe(201);
      expect(res.body.fallback).toBe(false);
      figures.push(res.body.figure);
    }

    expect(figures.length).toBe(5);
    expect(new Set(figures).size).toBe(5);
    plans.forEach((p, i) => expect(figures[i]).toBe(p.figure));
  });

  it("Tests A & B paired: contrasting situations return different figures when upstream JSON differs per request", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        const userMsg = userContentFromFetchInit(init);
        const figure = /grief|trauma regulation|bereavement/i.test(userMsg)
          ? "Bessel van der Kolk"
          : "James Clear";
        return {
          ok: true,
          json: async () => ({
            message: {
              content: JSON.stringify({
                figure,
                whyFit:
                  figure === "Bessel van der Kolk"
                    ? "Embodied regulation framing fits trauma language."
                    : "Atomic habits framing fits discipline and consistency struggles.",
                agentName: `Guide · ${figure}`,
                systemPrompt: longPrompt,
              }),
            },
          }),
        };
      })
    );

    const situationHabits =
      "I keep breaking promises to myself about routines and need stronger discipline and habit consistency.";
    const situationGrief =
      "After a sudden loss I feel numb and shut down; I need gentle support around grief and trauma regulation.";

    const resA = await request(app).post("/api/teachers/build-agent").send({ situation: situationHabits });
    const resB = await request(app).post("/api/teachers/build-agent").send({ situation: situationGrief });

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
    expect(resA.body.figure).toBe("James Clear");
    expect(resB.body.figure).toBe("Bessel van der Kolk");
    expect(resA.body.figure).not.toBe(resB.body.figure);
  });
});

describe("POST /api/teachers/recommend", () => {
  it("Test C: different chat contexts yield different teachers when model returns distinct names", async () => {
    db = new Database(":memory:");
    const { app } = createApp({ db });

    const habitsMarker = "CTX_HABITS_ATOMIC_ROUTINES";
    const griefMarker = "CTX_GRIEF_TRAUMA_REGULATION";

    db.prepare("INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)").run(
      1,
      "user",
      `I want discipline and consistent habits. ${habitsMarker}`
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        const userMsg = userContentFromFetchInit(init);
        const teacher = userMsg.includes(griefMarker) ? "Bessel van der Kolk" : "James Clear";
        return {
          ok: true,
          json: async () => ({
            message: {
              content: JSON.stringify({
                teacher,
                why: teacher === "James Clear" ? "Habits and systems thinking." : "Trauma-informed regulation.",
                guidance: "Small next step.",
                mantra: "One breath.",
              }),
            },
          }),
        };
      })
    );

    const rec1 = await request(app).post("/api/teachers/recommend").send({});
    expect(rec1.status).toBe(200);
    expect(rec1.body.teacher).toBe("James Clear");

    db.prepare("INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)").run(
      1,
      "user",
      `I feel shutdown after loss and need trauma-aware support. ${griefMarker}`
    );

    const rec2 = await request(app).post("/api/teachers/recommend").send({});
    expect(rec2.status).toBe(200);
    expect(rec2.body.teacher).toBe("Bessel van der Kolk");
    expect(rec1.body.teacher).not.toBe(rec2.body.teacher);
  });
});
