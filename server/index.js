import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { existsSync, mkdirSync } from "fs";
import { openDatabase, migrate } from "./db.js";
import { searchNotesForRag, searchNotesFullText } from "./noteSearch.js";
import { createAiProvider } from "./aiProvider.js";
import { computeHoroscopeAstronomy, parseBirthDateString } from "./horoscope.js";
import {
  buildGuideFallbackResponse,
  buildGuideSystemPrompt,
  contemplativeResponseQualityBlock,
  guideDepthModeForMessages,
  normalizeGuide,
  serializeGuideForDb,
} from "./guidePrompts.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = Number(process.env.PORT) || 3001;
const DATA_DIR = process.env.DATA_DIR || join(__dirname, "..", "data");
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1";

/* Optional: OpenAI-compatible API (e.g. Fireworks, Together, OpenAI) */
const CHAT_MODE = (process.env.CHAT_MODE || "ollama").toLowerCase();
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "accounts/fireworks/models/llama-v3p1-8b-instruct";
const aiProvider = createAiProvider({
  chatMode: CHAT_MODE,
  ollamaUrl: OLLAMA_URL,
  ollamaModel: OLLAMA_MODEL,
  openaiBaseUrl: OPENAI_BASE_URL,
  openaiApiKey: OPENAI_API_KEY,
  openaiModel: OPENAI_MODEL,
});

const BASE_SAFETY_PROMPT = `You are a calm, non-dogmatic guide for meditation and reflective inquiry.
Keep responses concise, warm, and practical.
Do not provide medical, psychiatric, or crisis advice.
If someone appears in danger or acute distress, encourage local emergency services or a licensed professional.`;

const PERSONA_PROMPTS = {
  presence: `Persona style: Presence.
- A contemplative companion with the presence of an enlightened spirit: calm, intelligent, mysterious, warm, and alive.
- Draw from philosophy, mysticism, poetry, meditation theory, phenomenology, and subtle inner practice when useful.
- Preserve wonder without becoming vague. Every abstract idea must become felt, usable, and grounded before the response ends.
- Speak like a living guide, not a lecturer, therapist, customer support assistant, or generic mindfulness chatbot.
- Beginner users receive simple accessible grounding. Advanced users may receive subtler, stranger, more expansive doorways.`,
};

const MAX_AGENT_SYSTEM_PROMPT_CHARS = 12_000;

function buildSystemPrompt(messages, extras = {}) {
  const rawOverride =
    typeof extras.agentSystemPrompt === "string" ? String(extras.agentSystemPrompt).trim() : "";
  const cappedOverride = rawOverride.slice(0, MAX_AGENT_SYSTEM_PROMPT_CHARS);
  const depthMode = guideDepthModeForMessages(messages);
  const personaBlock = cappedOverride
    ? `## Persona instructions (user-defined agent)\n${cappedOverride}`
    : PERSONA_PROMPTS.presence;

  let p = `${BASE_SAFETY_PROMPT}

${personaBlock}

${contemplativeResponseQualityBlock({
  depthMode,
  presence: !cappedOverride,
})}

Behavior rules:
- Do not mention persona switching unless asked.
- Ask one gentle follow-up question at most when helpful.
- Do not end every response with a question.
- Keep answers brief unless the user asks for depth.
- If advanced contemplative mode is active, offer a subtle concept or unexpected connection only when it can become directly experiential.`;
  if (extras.practice) {
    p += `

## Related practice the user selected
**Title:** ${String(extras.practice.title || "")}
**Excerpt:** ${String(extras.practice.summary || "")}
Let this color your reply; do not lecture the prompt back to them.`;
  }
  if (extras.noteSnippets && extras.noteSnippets.length > 0) {
    const lines = extras.noteSnippets
      .map(
        (s) =>
          `- ("${String(s.title || "note")}"): ${String(s.snippet).replace(/\s+/g, " ")}`
      )
      .join("\n");
    p += `

## Relevant journal (local, private; use for continuity only, do not quote the user)
${lines}`;
  }
  return p;
}

function getSetting(db, key, defaultVal = null) {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key);
  return row != null && row.value !== undefined && row.value !== "" ? row.value : defaultVal;
}

function setSetting(db, key, value) {
  db.prepare(
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).run(key, value);
}

function fallbackTitleFromBody(body) {
  const firstLine = String(body || "")
    .split("\n")
    .map((s) => s.trim())
    .find(Boolean);
  if (!firstLine) return "New note";
  return firstLine.replace(/\s+/g, " ").slice(0, 60);
}

async function generateNoteTitle(body) {
  const content = String(body || "").trim();
  if (!content) return "New note";
  const openaiFormat = [
    {
      role: "system",
      content:
        "Generate a concise note title (3-8 words). Plain text only, no quotes, no punctuation at the end. Keep it grounded and readable.",
    },
    {
      role: "user",
      content: "Create a short title for this note:\n\n" + content.slice(0, 1200),
    },
  ];

  try {
    const t = await aiProvider.complete(openaiFormat, { temperature: 0.3, timeoutMs: 40_000 });
    const oneLine = String(t).replace(/[\r\n]+/g, " ").trim();
    if (!oneLine) return fallbackTitleFromBody(content);
    return oneLine.slice(0, 80);
  } catch {
    return fallbackTitleFromBody(content);
  }

  return fallbackTitleFromBody(content);
}

function ymdLocal(d) {
  const t = d instanceof Date ? d : new Date();
  return (
    t.getFullYear() +
    "-" +
    String(t.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(t.getDate()).padStart(2, "0")
  );
}

const DAILY_HABITS_SYSTEM = `${BASE_SAFETY_PROMPT}

You are offering **gentle daily habits and emotional intentions** for today—not medical plans, workout prescriptions, or performance targets.

Persona: **Abraham Hicks–inspired** (uplifting emotional guidance / alignment language as commonly used in self-help).
- Tone: warm, encouraging, emotionally supportive; emphasize **relief**, **reaching for a slightly better-feeling thought**, and **appreciation** where it feels genuine.
- Each suggestion should be **small and today-sized** (a few minutes, a reframe, a pause, a boundary, noticing something that already feels okay).
- Do **not** promise specific futures, cures, or guaranteed outcomes. No clinical or diagnostic language.

Output:
1. One short opening line (one sentence) that sets the emotional tone for today.
2. Then **4–6 numbered habits or intentions**, each 1–2 sentences, concrete enough to try today.
3. Keep the whole response under ~500 words.`;

const CHAT_REFLECTION_SYSTEM = `${BASE_SAFETY_PROMPT}

You are creating an uplifting reflection from the user's own chat history.
- Tone: compassionate, hopeful, grounded, concise.
- Focus on strengths, themes, and practical encouragement.
- Do not diagnose or pathologize.
- Use short quotes only from provided excerpts.

Output format:
1) "What I notice in you" (3 bullets)
2) "Gentle advice for this week" (3-5 numbered suggestions)
3) "Inspiring lines to keep" (2-3 short quote lines, either from user excerpts or public-domain style wisdom)
Keep total output under 420 words.`;

const WEEKLY_REVIEW_SYSTEM = `${BASE_SAFETY_PROMPT}

You are writing a warm weekly review from the user's own notes and chats.
- Emphasize growth, resilience, and practical next steps.
- Keep tone inspiring but not inflated.
- No diagnosis, no promises, no medical advice.

Output:
1) Weekly review (short paragraph)
2) Patterns I noticed (3 bullets)
3) What helped this week (3 bullets)
4) Gentle plan for next week (5 numbered actions, each small)
5) Inspiring lines (2 short quote-style lines)
Keep under 520 words.`;

const INSIGHTS_SYSTEM = `${BASE_SAFETY_PROMPT}

You are a reflective coach generating concise life insights from journal/chat patterns.
- Focus on pattern recognition, strengths, and practical shifts.
- No diagnosis, no fear framing.

Output:
1) "Core themes" (3 bullets)
2) "Hidden strengths" (3 bullets)
3) "One shift to test this week" (3 numbered experiments)
4) "Compassionate reminder" (2 lines)
Keep under 380 words.`;

const SPIRITUAL_TEACHERS = [
  "Wayne Dyer",
  "Eckhart Tolle",
  "Abraham Hicks",
  "Thich Nhat Hanh",
  "Pema Chodron",
  "Ram Dass",
  "Alan Watts",
  "Deepak Chopra",
  "Byron Katie",
  "Paramahansa Yogananda",
  "Sadhguru",
  "Sri Sri Ravi Shankar",
  "Mooji",
  "Adyashanti",
  "Jiddu Krishnamurti",
  "Michael A. Singer",
  "Tara Brach",
  "Jack Kornfield",
  "Sharon Salzberg",
  "Joseph Goldstein",
  "Chogyam Trungpa",
  "Dalai Lama",
  "B.K.S. Iyengar",
  "Pattabhi Jois",
  "T.K.V. Desikachar",
  "Krishnamacharya",
  "Swami Sivananda",
  "Swami Vivekananda",
  "Neem Karoli Baba",
  "Sri Ramana Maharshi",
  "Nisargadatta Maharaj",
  "OSHO",
  "Rumi",
  "Khalil Gibran",
  "Yogananda Lahiri Mahasaya lineage",
  "Brené Brown",
  "Louise Hay",
  "Marianne Williamson",
  "Don Miguel Ruiz",
  "Anthony de Mello",
  "Thomas Merton",
  "Brother David Steindl-Rast",
  "Gangaji",
  "Papaji",
  "Rupert Spira",
  "David R. Hawkins",
  "Sister Shivani",
  "Sogyal Rinpoche",
  "Ajahn Chah",
  "Ajahn Brahm",
  // Historical philosophers & wisdom voices
  "Marcus Aurelius",
  "Seneca",
  "Epictetus",
  "Plato",
  "Aristotle",
  "Confucius",
  "Laozi",
  "Zhuangzi",
  "Baruch Spinoza",
  "Søren Kierkegaard",
  "Friedrich Nietzsche",
  "Simone de Beauvoir",
  "Viktor Frankl",
  "William James",
  "John Dewey",
  // Psychology / therapy lineage
  "Carl Rogers",
  "Abraham Maslow",
  "Carl Jung",
  "Alfred Adler",
  "Aaron Beck",
  "Albert Ellis",
  "Marsha Linehan",
  "Donald Winnicott",
  "John Bowlby",
  "Irvin Yalom",
  "Esther Perel",
  "John Gottman",
  "Julie Gottman",
  "Sue Johnson",
  "Terry Real",
  "Harriet Lerner",
  "Gabor Maté",
  "Bessel van der Kolk",
  "Peter Levine",
  "Richard Schwartz",
  "Steven Hayes",
  "Susan David",
  "Lori Gottlieb",
  "Guy Winch",
  "Martin Seligman",
  "Carol Dweck",
  "Daniel Kahneman",
  "Daniel Goleman",
  "Angela Duckworth",
  // Contemporary reflective / self-help writers
  "James Clear",
  "Ryan Holiday",
  "Mark Manson",
  "Cal Newport",
  "Simon Sinek",
  "Adam Grant",
  "Gretchen Rubin",
  "Hal Elrod",
  "Jay Shetty",
  "Mel Robbins",
  "James Hollis",
  "Robert Greene",
  "Jordan Peterson",
  "Nedra Glover Tawwab",
  "bell hooks",
];

const TEACHER_AGENT_CATALOG = [...new Set(SPIRITUAL_TEACHERS.map((t) => String(t).trim()).filter(Boolean))];

const TEACHER_GUIDANCE_SYSTEM = `${BASE_SAFETY_PROMPT}

You are selecting one public figure, lineage, or school of thought whose published work best resonates with the user's patterns (historical or contemporary: contemplative teachers, philosophers, therapist-authors, psychology writers, reflective essayists, etc.).
- Output a **specific** primary name on the "teacher" string; you may add a short clarifying subtitle in parentheses (e.g. "James Clear (habits)" or "Thích Nhất Hạnh").
- Write guidance in that **inspired** voice: practical and warm, **without fabricating direct quotes** or implying they authored this app text.
- Avoid medical/legal certainty; encourage licensed professional help when serious distress, self-harm, or abuse appears.

Output JSON ONLY:
{
  "teacher": "<one line: name, optional short subtitle in parentheses>",
  "why": "<2-3 sentences on fit>",
  "guidance": "<4-7 short paragraphs in that voice>",
  "mantra": "<one short line>"
}`;

const AGENT_NAME_MAX = 80;
const AGENT_PROMPT_MAX = 4000;
/** Max length for model-supplied "figure" / "teacher" display labels (name + optional subtitle). */
const FIGURE_LABEL_MAX = 120;

function buildAgentSystemPrompt(personaPrompt, messages = []) {
  const p = String(personaPrompt || "").trim().slice(0, AGENT_PROMPT_MAX);
  const depthMode = guideDepthModeForMessages(messages);
  const body =
    p ||
    "You are a calm, spacious companion for presence and reflective inquiry. Keep replies brief and warm.";
  return `${BASE_SAFETY_PROMPT}

## Persona (user-defined)
Follow these instructions closely while honoring every safety rule above:
${body}

${contemplativeResponseQualityBlock({ depthMode })}

Behavior:
- Stay concise unless the user asks for depth.
- At most one gentle follow-up question when it clearly helps.
- Do not end every response with a question.`;
}

function selectAgentRows(db) {
  return db
    .prepare(
      `SELECT id, name, system_prompt, short_description, role_purpose, tone, speaking_style,
              encouragement_style, focus_areas_json, boundaries_json, context_access_json,
              behavior_tuning_json, custom_instructions, is_active, created_at, updated_at
       FROM custom_agents`
    )
    .all();
}

function selectAgentRow(db, id) {
  return db
    .prepare(
      `SELECT id, name, system_prompt, short_description, role_purpose, tone, speaking_style,
              encouragement_style, focus_areas_json, boundaries_json, context_access_json,
              behavior_tuning_json, custom_instructions, is_active, created_at, updated_at
       FROM custom_agents
       WHERE id = ?`
    )
    .get(id);
}

function agentResponse(row) {
  const guide = normalizeGuide(row);
  return {
    ...row,
    guide,
    shortDescription: guide.shortDescription,
    rolePurpose: guide.rolePurpose,
    focusAreas: guide.focusAreas,
    boundaries: guide.boundaries,
    contextAccess: guide.contextAccess,
    behaviorTuning: guide.behaviorTuning,
    customInstructions: guide.customInstructions,
    isActive: guide.isActive,
  };
}

function hasStructuredGuideInput(body = {}) {
  return (
    [
      body.shortDescription,
      body.description,
      body.rolePurpose,
      body.role,
      body.tone,
      body.speakingStyle,
      body.encouragementStyle,
      body.customInstructions,
    ].some((value) => String(value ?? "").trim()) ||
    Array.isArray(body.focusAreas) ||
    Array.isArray(body.focus) ||
    Boolean(body.boundaries) ||
    Boolean(body.contextAccess) ||
    Boolean(body.behaviorTuning)
  );
}

function buildAgentAppContext(db, guide) {
  if (!guide?.contextAccess?.enabled) return null;
  const sources = guide.contextAccess.sources || {};
  const allowedTypes = [];
  if (sources.notes) allowedTypes.push("general");
  if (sources.gratitudes) allowedTypes.push("gratitude");
  if (sources.reflections) allowedTypes.push("reflection");
  if (sources.intentions) allowedTypes.push("intention");
  if (!allowedTypes.length) return null;
  const placeholders = allowedTypes.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT title, body, note_type
       FROM notes
       WHERE note_type IN (${placeholders})
       ORDER BY updated_at DESC, id DESC
       LIMIT 8`
    )
    .all(...allowedTypes);
  if (!rows.length) return null;
  return {
    sources: allowedTypes,
    items: rows.map((row) => ({
      type: String(row.note_type || "note"),
      text: `${String(row.title || "").trim()}: ${String(row.body || "").trim()}`.trim(),
    })),
  };
}

function collectRecentNotesForHabits(db, limit) {
  const n = Math.min(12, Math.max(0, Number(limit) || 0));
  if (n === 0) return [];
  const rows = db
    .prepare("SELECT title, body FROM notes ORDER BY updated_at DESC, id DESC LIMIT ?")
    .all(n);
  return rows.map((r) => ({
    title: String(r.title || ""),
    excerpt: String(r.body || "").replace(/\s+/g, " ").trim().slice(0, 420),
  }));
}

function buildDailyHabitsUserMessage(dateYmd, noteBlocks) {
  let u = `Today's date (for context): ${dateYmd}.\n\n`;
  if (!noteBlocks.length) {
    u +=
      "The user has **no recent notes** in this app yet—still offer fresh, kind habits for today from general alignment themes.\n\n";
  } else {
    u +=
      "Below are **short excerpts** from the user's most recently updated notes (local only; use as loose inspiration, do not copy long phrases back):\n\n";
    noteBlocks.forEach((b, i) => {
      u += `(${i + 1}) **${b.title || "Note"}**: ${b.excerpt}\n\n`;
    });
  }
  u +=
    "Task: Propose **gentle habits or intentions for today** in the Abraham Hicks–inspired style—feeling-forward, compassionate, grounded. Number each item clearly.";
  return u;
}

function collectChatHistoryForReflection(db) {
  const rows = db
    .prepare(
      `SELECT m.role, m.content, m.created_at, s.title AS session_title
       FROM chat_messages m
       LEFT JOIN chat_sessions s ON s.id = m.session_id
       ORDER BY m.id ASC`
    )
    .all();
  const totalMessages = rows.length;
  const totalSessions =
    db.prepare("SELECT COUNT(*) AS c FROM chat_sessions").get()?.c || 0;
  const userTurns = rows.filter((r) => String(r.role) === "user");
  const sampleTurns = userTurns.slice(-28).map((r) => ({
    session: String(r.session_title || "Chat"),
    at: String(r.created_at || ""),
    text: String(r.content || "").replace(/\s+/g, " ").trim().slice(0, 240),
  }));
  return { totalMessages, totalSessions, sampleTurns };
}

function buildChatReflectionUserMessage(stats) {
  if (!stats.sampleTurns.length) {
    return "No user chat turns are available yet. Return a kind invitation to begin, plus 3 gentle starter prompts.";
  }
  let m = `Stats: ${stats.totalSessions} sessions, ${stats.totalMessages} messages total.\n\n`;
  m += "Recent user excerpts:\n";
  stats.sampleTurns.forEach((t, i) => {
    m += `${i + 1}. [${t.session}] ${t.text}\n`;
  });
  m +=
    "\nTask: offer an uplifting, grounded reflection based on these excerpts and include practical encouragement.";
  return m;
}

function fallbackChatReflection(stats) {
  const hasHistory = stats.totalMessages > 0;
  if (!hasHistory) {
    return [
      "What I notice in you",
      "- You showed up here, which already means you care about your inner life.",
      "- You are willing to reflect instead of rushing past your feelings.",
      "- You can build calm in small steps, not perfect leaps.",
      "",
      "Gentle advice for this week",
      "1. Keep one 5-minute check-in each day: What am I feeling? What do I need?",
      "2. End each day with one line of gratitude, even if it is tiny.",
      "3. Choose one calming practice and repeat it, rather than switching constantly.",
      "",
      "Inspiring lines to keep",
      "\"You do not have to force the river to flow.\"",
      "\"Small, kind repetitions become a peaceful life.\"",
    ].join("\n");
  }
  return [
    "What I notice in you",
    "- You keep returning to reflection, which is a quiet form of courage.",
    "- You are looking for steadiness, not noise.",
    "- Your growth shows up in consistency more than intensity.",
    "",
    "Gentle advice for this week",
    "1. Pick one emotional intention each morning and return to it at lunch.",
    "2. When chat feels heavy, capture one sentence in Notes to close the loop.",
    "3. Keep practices short and repeatable; aim for rhythm, not performance.",
    "4. Celebrate one thing that went slightly better each evening.",
    "",
    "Inspiring lines to keep",
    "\"Peace often arrives quietly, through repeated small choices.\"",
    "\"You are allowed to grow gently.\"",
  ].join("\n");
}

function collectWeeklyContext(db) {
  const notes = db
    .prepare(
      `SELECT title, body, updated_at
       FROM notes
       WHERE datetime(updated_at) >= datetime('now', '-7 days')
       ORDER BY updated_at DESC, id DESC
       LIMIT 30`
    )
    .all()
    .map((r) => ({
      title: String(r.title || ""),
      excerpt: String(r.body || "").replace(/\s+/g, " ").trim().slice(0, 220),
      updated_at: String(r.updated_at || ""),
    }));

  const chats = db
    .prepare(
      `SELECT s.title AS session_title, m.content, m.created_at
       FROM chat_messages m
       LEFT JOIN chat_sessions s ON s.id = m.session_id
       WHERE m.role = 'user' AND datetime(m.created_at) >= datetime('now', '-7 days')
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT 36`
    )
    .all()
    .map((r) => ({
      session: String(r.session_title || "Chat"),
      excerpt: String(r.content || "").replace(/\s+/g, " ").trim().slice(0, 220),
      created_at: String(r.created_at || ""),
    }));

  return {
    noteCount: notes.length,
    chatTurns: chats.length,
    notes,
    chats,
  };
}

function collectInsightsContext(db) {
  const notes = db
    .prepare(
      `SELECT title, body, updated_at
       FROM notes
       ORDER BY updated_at DESC, id DESC
       LIMIT 24`
    )
    .all()
    .map((n) => ({
      title: String(n.title || ""),
      excerpt: String(n.body || "").replace(/\s+/g, " ").trim().slice(0, 220),
      updated_at: String(n.updated_at || ""),
    }));
  const turns = db
    .prepare(
      `SELECT m.content, m.created_at, s.title AS session_title
       FROM chat_messages m
       LEFT JOIN chat_sessions s ON s.id = m.session_id
       WHERE m.role = 'user'
       ORDER BY m.id DESC
       LIMIT 30`
    )
    .all()
    .map((m) => ({
      session: String(m.session_title || "Chat"),
      excerpt: String(m.content || "").replace(/\s+/g, " ").trim().slice(0, 220),
      created_at: String(m.created_at || ""),
    }));
  return { notes, turns, noteCount: notes.length, turnCount: turns.length };
}

function buildInsightsUserMessage(ctx) {
  if (ctx.noteCount === 0 && ctx.turnCount === 0) {
    return "No note/chat history exists yet. Provide gentle starter insights for a reflective beginner.";
  }
  let msg = `Context: ${ctx.noteCount} notes and ${ctx.turnCount} user chat turns.\n\n`;
  if (ctx.notes.length) {
    msg += "Recent notes:\n";
    ctx.notes.forEach((n, i) => {
      msg += `${i + 1}. [${n.title || "Note"}] ${n.excerpt}\n`;
    });
    msg += "\n";
  }
  if (ctx.turns.length) {
    msg += "Recent chat turns:\n";
    ctx.turns.forEach((t, i) => {
      msg += `${i + 1}. [${t.session}] ${t.excerpt}\n`;
    });
  }
  return msg;
}

function parseIsoishToDate(value) {
  const raw = String(value || "");
  if (!raw) return null;
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ymdFromDate(d) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function buildInsightsMetrics(ctx) {
  const now = new Date();
  const dayBuckets = [];
  const dayMap = new Map();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ymd = ymdFromDate(d);
    const item = {
      ymd,
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      notes: 0,
      chats: 0,
      total: 0,
    };
    dayBuckets.push(item);
    dayMap.set(ymd, item);
  }

  for (const n of ctx.notes) {
    const d = parseIsoishToDate(n.updated_at);
    if (!d) continue;
    const ymd = ymdFromDate(d);
    const bucket = dayMap.get(ymd);
    if (!bucket) continue;
    bucket.notes += 1;
    bucket.total += 1;
  }
  for (const t of ctx.turns) {
    const d = parseIsoishToDate(t.created_at);
    if (!d) continue;
    const ymd = ymdFromDate(d);
    const bucket = dayMap.get(ymd);
    if (!bucket) continue;
    bucket.chats += 1;
    bucket.total += 1;
  }

  const text = [...ctx.notes.map((n) => n.excerpt), ...ctx.turns.map((t) => t.excerpt)]
    .join(" ")
    .toLowerCase();
  const TRACKED_TERMS = [
    "calm",
    "anxiety",
    "stress",
    "focus",
    "gratitude",
    "sleep",
    "breath",
    "presence",
    "overwhelm",
    "clarity",
    "energy",
    "confidence",
  ];
  const topKeywords = TRACKED_TERMS.map((word) => {
    const re = new RegExp(`\\b${word}\\b`, "g");
    const count = (text.match(re) || []).length;
    return { word, count };
  })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const groundedWords = ["calm", "gratitude", "presence", "clarity", "breath", "ease", "steady"];
  const activatedWords = ["stress", "anxiety", "overwhelm", "panic", "tired", "fear", "restless"];
  const countWords = (arr) =>
    arr.reduce((acc, w) => acc + ((text.match(new RegExp(`\\b${w}\\b`, "g")) || []).length), 0);
  const grounded = countWords(groundedWords);
  const activated = countWords(activatedWords);

  const activeDays = dayBuckets.filter((d) => d.total > 0).length;
  const totalCaptures = dayBuckets.reduce((acc, d) => acc + d.total, 0);
  const consistency = Math.round((activeDays / 7) * 100);

  return {
    days: dayBuckets,
    topKeywords,
    emotionalBalance: { grounded, activated },
    totalCaptures,
    activeDays,
    consistencyScore: consistency,
  };
}

function fallbackInsights(ctx) {
  const haveData = ctx.noteCount + ctx.turnCount > 0;
  if (!haveData) {
    return [
      "Core themes",
      "- You are seeking steadiness over intensity.",
      "- You want practical spirituality, not abstraction.",
      "- You respond to gentle structure.",
      "",
      "Hidden strengths",
      "- You keep returning to reflection.",
      "- You are willing to learn from difficult moments.",
      "- You already notice subtle emotional shifts.",
      "",
      "One shift to test this week",
      "1. Begin each day with one sentence of intention.",
      "2. Use one breath cue before checking your phone.",
      "3. End each day with one line of gratitude.",
      "",
      "Compassionate reminder",
      "You are not behind; you are unfolding.",
      "Small consistent kindness changes everything.",
    ].join("\n");
  }
  return [
    "Core themes",
    "- You seek emotional clarity and grounded calm.",
    "- You value meaning, not just productivity.",
    "- You benefit from returning to simple rituals.",
    "",
    "Hidden strengths",
    "- You already self-correct when you drift.",
    "- You can hold nuance without shutting down.",
    "- You are building trust in your own inner signal.",
    "",
    "One shift to test this week",
    "1. Keep a two-minute pause between stress and response.",
    "2. Translate one chat insight into one concrete action daily.",
    "3. Celebrate one 'quiet win' each evening.",
    "",
    "Compassionate reminder",
    "You do not need to force transformation to grow.",
    "Gentle repetition is enough.",
  ].join("\n");
}

function buildTeacherRecommendationUserMessage(ctx) {
  let prompt =
    "Choose ONE guide voice (any suitable well-known public thinker or school) that best resonates with the user's emotional and reflective language.\n\nUser context:\n";
  if (ctx.notes.length === 0 && ctx.turns.length === 0) {
    prompt += "No historical data yet; choose a broadly supportive beginner-friendly teacher.\n";
  } else {
    ctx.notes.slice(0, 14).forEach((n, i) => {
      prompt += `Note ${i + 1}: ${n.excerpt}\n`;
    });
    ctx.turns.slice(0, 18).forEach((t, i) => {
      prompt += `Chat ${i + 1}: ${t.excerpt}\n`;
    });
  }
  return prompt;
}

function fallbackTeacherGuidance(ctx) {
  const allText = [...ctx.notes.map((n) => n.excerpt), ...ctx.turns.map((t) => t.excerpt)]
    .join(" ")
    .toLowerCase();
  let teacher = "Eckhart Tolle";
  if (/gratitude|appreciat|alignment|manifest/.test(allText)) teacher = "Abraham Hicks";
  else if (/breath|present|mindful|compassion/.test(allText)) teacher = "Thich Nhat Hanh";
  else if (/purpose|intention|self/.test(allText)) teacher = "Wayne Dyer";
  return {
    teacher,
    why: `${teacher} fits your tone because your writing leans toward calm inner alignment and present-moment clarity rather than force.`,
    guidance:
      teacher === "Abraham Hicks"
        ? "You do not need to solve your whole life tonight. Reach for the next thought that feels a little lighter.\n\nYour emotional guidance is not a flaw; it is your compass. Let relief be the metric.\n\nToday, choose one small action that feels kind and possible. Alignment grows through gentle repetition."
        : teacher === "Thich Nhat Hanh"
          ? "Dear friend, come back to one conscious breath. This moment is enough.\n\nWhen your mind runs ahead, place your hand on your heart and return to your body.\n\nWalk slowly with your next step and allow peace to arrive before certainty."
          : "You are not here to become someone else. You are here to remember your deeper self.\n\nThe way forward is simple: choose thoughts that strengthen your inner posture.\n\nLive from intention, not urgency, and your life will begin to mirror your spirit.",
    mantra: "I return to what is true, kind, and steady within me.",
  };
}

function parseJsonObjectFromModelText(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  const stripped = s
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const first = stripped.indexOf("{");
    const last = stripped.lastIndexOf("}");
    if (first >= 0 && last > first) {
      const mid = stripped.slice(first, last + 1);
      try {
        return JSON.parse(mid);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Normalize model-supplied figure/teacher labels: trim, single-line, length cap, reject obvious junk. */
function sanitizeFigureLabel(raw, maxLen = FIGURE_LABEL_MAX) {
  let s = String(raw ?? "")
    .replace(/\s+/g, " ")
    .replace(/[\r\n]+/g, " ")
    .trim();
  if (!s) return null;
  if (s.includes("```")) return null;
  s = s.slice(0, maxLen).trim();
  if (s.length < 2) return null;
  return s;
}

const TEACHER_AGENT_BUILD_SYSTEM = `${BASE_SAFETY_PROMPT}

You are designing a **stored Guide agent** for a private local app.
The user will chat with this agent in a calm, presence-oriented product.

Task:
1) Choose **exactly ONE** suitable public figure, tradition, or school for the situation (historical or contemporary psychology, philosophy, contemplative lineages, reflective writers, etc.). Set JSON field "figure" to one readable line: primary name plus optional short subtitle in parentheses if useful (e.g. "James Clear (habits)", "Thích Nhất Hạnh", "Carl Rogers (person-centered)"). Do not use markdown or code fences inside "figure".
2) Write a **system prompt** for that guide: voice, values, boundaries, and how they help with the user's situation. Inspired-by style only: **do not fabricate direct quotes** or claim the real person authored the text.
3) Avoid medical/legal/crisis handling beyond brief encouragement to seek licensed help when appropriate.
4) Keep "systemPrompt" within the character budget the user message states (hard cap applies server-side).

Output **strict JSON only** (no markdown fences), keys:
{
  "figure": "<one line label>",
  "whyFit": "<2-4 sentences on why this voice fits the situation>",
  "agentName": "<short display name, e.g. Guide · Viktor Frankl — max 80 chars>",
  "systemPrompt": "<full persona instructions for the chat model — max length given in user message>"
}`;

function buildTeacherAgentFromSituationUserMessage({ situation, noteBlocks, maxPromptChars }) {
  let msg = `Build a Guide agent from the user's situation and/or journal excerpts.\n`;
  msg += `Maximum length for "systemPrompt" in your JSON: ${maxPromptChars} characters.\n\n`;
  msg += `Pick any appropriate public guide voice for this person—not limited to a preset list. The "figure" field is a short display label only.\n\n`;
  if (situation) {
    msg += `## User situation (their words)\n${situation}\n\n`;
  } else {
    msg += `## User situation\n(Not provided — infer gently only from journal excerpts below.)\n\n`;
  }
  if (noteBlocks.length) {
    msg += `## Recent journal excerpts (local)\n`;
    noteBlocks.forEach((b, i) => {
      msg += `${i + 1}. **${b.title || "Note"}**: ${b.excerpt}\n`;
    });
    msg += `\n`;
  }
  msg += `Return the JSON object now.`;
  return msg;
}

/** When no keyword bucket matches, rotate so local fallback is not always the same voice. */
const FALLBACK_FIGURE_ROTATION = [
  "Tara Brach",
  "James Clear",
  "Viktor Frankl",
  "Esther Perel",
  "Oliver Burkeman",
];

function hashRotationFigure(blob) {
  const s = String(blob || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return FALLBACK_FIGURE_ROTATION[Math.abs(h) % FALLBACK_FIGURE_ROTATION.length];
}

function fallbackTeacherAgentBuild({ situation, noteBlocks }) {
  const blob = `${situation}\n${noteBlocks.map((b) => b.excerpt).join(" ")}`.toLowerCase();
  let figure = null;
  if (/inner body|inside my body|somatic|embodiment|interoception|felt sense|felt-sense/.test(blob)) {
    figure = "Tara Brach";
  } else if (/relationship|partner|marriage|love|heartbreak|boundary|trust/.test(blob)) {
    figure = "Esther Perel";
  } else if (/habit|discipline|routine|procrastin|focus|productiv/.test(blob)) {
    figure = "James Clear";
  } else if (/grief|trauma|bereave|dysregul|flashback|panic attack|freeze/.test(blob)) {
    figure = "Bessel van der Kolk";
  } else if (/meaning|purpose|suffer|logotherap/.test(blob)) {
    figure = "Viktor Frankl";
  } else if (/anger|family|parent|child|communicat/.test(blob)) {
    figure = "Harriet Lerner";
  } else {
    figure = hashRotationFigure(blob);
  }
  const agentName = `Guide · ${figure}`.slice(0, AGENT_NAME_MAX);
  const systemPrompt = `You are a private chat guide inspired by the voice and teachings associated with ${figure}, without claiming to be them or quoting them directly.

Situation context (user-provided): ${situation ? situation.slice(0, 1200) : "Journal-only context; stay gentle and general."}

How to answer:
- Short paragraphs, warm and practical.
- Invite reflection and small experiments; avoid dogma.
- Do not give medical, psychiatric, or legal advice; encourage professional help when needed.
- Never invent direct quotes from ${figure}.`.slice(0, AGENT_PROMPT_MAX);
  return {
    figure,
    whyFit: `Starting from ${figure}: this lens often fits threads like yours (relationships, habits, meaning, regulation, or presence). Refine the name or prompt anytime in Agent builder.`,
    agentName,
    systemPrompt,
  };
}

function buildWeeklyReviewUserMessage(ctx) {
  if (ctx.noteCount === 0 && ctx.chatTurns === 0) {
    return "No notes or chat turns exist in the last 7 days. Provide a kind weekly reset review with starter actions.";
  }
  let msg = `Weekly context stats: ${ctx.noteCount} notes, ${ctx.chatTurns} chat turns in the last 7 days.\n\n`;
  if (ctx.notes.length > 0) {
    msg += "Notes excerpts:\n";
    ctx.notes.forEach((n, i) => {
      msg += `${i + 1}. [${n.title || "Note"}] ${n.excerpt}\n`;
    });
    msg += "\n";
  }
  if (ctx.chats.length > 0) {
    msg += "Chat excerpts:\n";
    ctx.chats.forEach((c, i) => {
      msg += `${i + 1}. [${c.session}] ${c.excerpt}\n`;
    });
  }
  return msg;
}

function fallbackWeeklyReview(ctx) {
  if (ctx.noteCount === 0 && ctx.chatTurns === 0) {
    return [
      "Weekly review",
      "You are at a fresh beginning this week, and that is a strong place to start from.",
      "",
      "Patterns I noticed",
      "- You are willing to pause and reflect.",
      "- You want calm that is realistic, not performative.",
      "- You respond well to gentle consistency.",
      "",
      "What helped this week",
      "- Returning to simple breathing cues.",
      "- Naming feelings without judging them.",
      "- Taking one tiny action rather than waiting for motivation.",
      "",
      "Gentle plan for next week",
      "1. One 5-minute sit each day, same time if possible.",
      "2. Capture one sentence in Notes after any emotional spike.",
      "3. End each day with one gratitude line.",
      "4. Do one short practice when stress rises, not after burnout.",
      "5. Review this plan once mid-week and soften it if needed.",
      "",
      "Inspiring lines",
      "\"Gentle repetition is a form of self-trust.\"",
      "\"You can grow quietly and still grow deeply.\"",
    ].join("\n");
  }
  return [
    "Weekly review",
    "You kept returning to awareness this week, and that consistency matters more than intensity.",
    "",
    "Patterns I noticed",
    "- You are actively searching for steadier emotional footing.",
    "- Reflection and language help you regulate.",
    "- You do better with small anchors than big plans.",
    "",
    "What helped this week",
    "- Brief check-ins instead of long perfectionist sessions.",
    "- Turning chat insights into notes.",
    "- Keeping expectations compassionate and realistic.",
    "",
    "Gentle plan for next week",
    "1. Keep one morning intention line each day.",
    "2. Use one trusted practice as your default reset.",
    "3. Log one micro-win every evening.",
    "4. Protect one short no-phone quiet block daily.",
    "5. Ask for the next better-feeling thought when overwhelmed.",
    "",
    "Inspiring lines",
    "\"A calmer life is built in small, repeatable moments.\"",
    "\"Progress often looks like returning, again and again.\"",
  ].join("\n");
}

function collectSessionTurnsForPractice(db, sessionId) {
  const rows = db
    .prepare(
      `SELECT role, content
       FROM chat_messages
       WHERE session_id = ?
       ORDER BY id DESC
       LIMIT 18`
    )
    .all(sessionId)
    .reverse();
  return rows.map((r) => ({
    role: String(r.role || "user"),
    content: String(r.content || "").replace(/\s+/g, " ").trim().slice(0, 360),
  }));
}

function fallbackGeneratedPractice(turns) {
  const lastUser = [...turns].reverse().find((t) => t.role === "user");
  const seed = String(lastUser?.content || "").toLowerCase();
  const title = seed.includes("sleep")
    ? "Evening Soft Landing"
    : seed.includes("anx")
      ? "Steady Breath Reset"
      : "Gentle Return Practice";
  return {
    title,
    summary:
      "Sit or stand comfortably. Inhale for 4, exhale for 6, for 2-3 minutes. Name one feeling without judgment. Choose one kind next step and carry it into the next hour.",
    category: "generated",
    tags: ["generated", "chat", "short"],
    est_minutes: 6,
  };
}

function prevYmd(ymd) {
  const [Y, M, D] = ymd.split("-").map(Number);
  const x = new Date(Y, M - 1, D);
  x.setDate(x.getDate() - 1);
  return ymdLocal(x);
}

function pickSuggestedPractice(db, lastUserText, lastSessionTitle) {
  const rows = db
    .prepare("SELECT id, title, summary, tags, category FROM practices ORDER BY sort_order, id")
    .all();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const hay = `${String(lastUserText || "")} ${String(lastSessionTitle || "")}`.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const r of rows) {
    let tags = [];
    try {
      tags = r.tags ? JSON.parse(r.tags) : [];
    } catch {
      tags = [];
    }
    let score = 0;
    if (r.title) {
      for (const w of String(r.title).toLowerCase().split(/\W+/)) {
        if (w.length > 3 && hay.includes(w)) score += 2;
      }
    }
    for (const t of tags) {
      if (t && String(t).length > 1 && hay.includes(String(t).toLowerCase())) score += 2;
    }
    if (r.summary) {
      for (const w of String(r.summary).toLowerCase().split(/\W+/)) {
        if (w.length > 4 && hay.includes(w)) score += 0.3;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = { id: r.id, title: r.title, summary: r.summary, category: r.category };
    }
  }
  if (best) return best;
  return rows[0] ? { id: rows[0].id, title: rows[0].title, summary: rows[0].summary, category: rows[0].category } : null;
}

function maybeAutotitleSession(db, sessionId, userContent) {
  const c = db.prepare("SELECT COUNT(*) as c FROM chat_messages WHERE session_id = ?").get(sessionId)
    .c;
  if (c > 0) return;
  const s = db.prepare("SELECT title FROM chat_sessions WHERE id = ?").get(sessionId);
  if (!s) return;
  if (s.title !== "New chat" && s.title !== "Previous chat") return;
  const raw = String(userContent).replace(/\s+/g, " ").trim();
  if (!raw) return;
  const t = raw.slice(0, 60);
  db.prepare("UPDATE chat_sessions SET title = ?, updated_at = datetime('now') WHERE id = ?").run(
    t,
    sessionId
  );
}

const HOROSCOPE_DAILY_SYSTEM = `${BASE_SAFETY_PROMPT}

You write brief **horoscope-style entertainment copy** for a private wellness app.
Rules:
- Output **only valid JSON** (no markdown fences, no commentary).
- Do **not** claim scientific accuracy, destiny, or predictions about health, law, money, or relationships.
- Language must stay playful, optional, and low-stakes.

Return exactly this JSON shape (these keys only):
{
  "love": ["…","…","…"],
  "career": ["…","…","…"],
  "personal": ["…","…","…"],
  "closing": "one short atmospheric line about today's symbolic mood",
  "disclaimerHint": "one short line: for fun, not professional advice"
}

Use exactly **three** short bullet strings per category (single clauses or short sentences).`;

function horoscopeDailyFallback(facts) {
  const { sunSign, moonSignApprox, moonPhase, moonIlluminationPercent } = facts;
  const phaseLc = String(moonPhase || "Moon").toLowerCase();
  return {
    love: [
      `Let affection move slowly—${sunSign} warmth lands best in small, sincere gestures.`,
      `Listen generously; the ${phaseLc} Moon favors patience over conclusions in matters of the heart.`,
      `Share something gentle and true without needing an immediate answer.`,
    ],
    career: [
      `Keep tasks bite-sized; pacing beats pushing while the Moon rides approximately through ${moonSignApprox}.`,
      `Collaborate lightly—clarity often follows a pause under a ${phaseLc} sky.`,
      `Note one modest win from yesterday and let it steady your next step.`,
    ],
    personal: [
      `Ground with breath or a short walk; the symbolic weather is reflective, not urgent.`,
      `Name one feeling without fixing it—naming alone can be enough for today.`,
      `Return to a simple ritual that has soothed you before.`,
    ],
    closing: `A ${phaseLc} Moon at about ${moonIlluminationPercent}% illumination invites curiosity over certainty.`,
    disclaimerHint: `For entertainment only—not a scientific chart reading or professional advice.`,
  };
}

function sanitizeHoroscopeStringArray(raw, fallback, maxLen = 240, count = 3) {
  const fb = Array.isArray(fallback) ? fallback : [];
  const arr = Array.isArray(raw) ? raw : [];
  const out = [];
  for (let i = 0; i < count; i++) {
    let s = typeof arr[i] === "string" ? arr[i].trim() : "";
    s = s.replace(/\s+/g, " ").slice(0, maxLen);
    out.push(s || String(fb[i] || "").trim() || "Pause and listen inward—today favors gentle noticing.");
  }
  return out;
}

function mergeHoroscopeResponse(facts, parsed, usedFallback) {
  const fb = horoscopeDailyFallback(facts);
  const closing =
    typeof parsed?.closing === "string" && parsed.closing.trim()
      ? parsed.closing.trim().replace(/\s+/g, " ").slice(0, 420)
      : fb.closing;
  const disclaimerHint =
    typeof parsed?.disclaimerHint === "string" && parsed.disclaimerHint.trim()
      ? parsed.disclaimerHint.trim().replace(/\s+/g, " ").slice(0, 300)
      : fb.disclaimerHint;
  return {
    sunSign: facts.sunSign,
    moonSignApprox: facts.moonSignApprox,
    moonPhase: facts.moonPhase,
    moonIlluminationPercent: facts.moonIlluminationPercent,
    love: sanitizeHoroscopeStringArray(parsed?.love, fb.love),
    career: sanitizeHoroscopeStringArray(parsed?.career, fb.career),
    personal: sanitizeHoroscopeStringArray(parsed?.personal, fb.personal),
    closing,
    disclaimerHint,
    fallback: Boolean(usedFallback),
  };
}

const AMBIENCE_MOOD_SYSTEM = `${BASE_SAFETY_PROMPT}

You are a **sound-design assistant** for a private app that plays **simple synthesized ambience** in the browser (Web Audio API): layered **sine** and **triangle** oscillators through one **low-pass filter**—no audio files, no samples.

The user describes a **mood or desired atmosphere** in plain language. Choose numeric parameters so the result feels emotionally matched: soft onsets, no harsh brightness unless they asked for energy, avoid startling high frequencies.

Return **only valid JSON** (no markdown fences, no commentary). Exact keys:

{
  "title": "short poetic name (max 44 chars)",
  "description": "one warm UI line (max 180 chars)",
  "layers": [
    { "waveform": "sine", "frequencyHz": 122, "detuneCents": -4, "gain": 0.06 }
  ],
  "lowpassHz": 1100,
  "lowpassQ": 0.85,
  "masterPeak": 0.2,
  "swellSeconds": 5.5,
  "filterSweepToHz": 1600
}

Hard rules:
- **3 or 4** objects in "layers" (prefer 3). Use small-integer ratio stacks (e.g. ~2:3:4 in Hz) or gentle beating (a few Hz apart)—never chaotic micro-intervals.
- **waveform** is only "sine" or "triangle".
- **frequencyHz** per layer: 55–360 (use 55–95 for at most one sub layer when mood is heavy or sleepy).
- **detuneCents**: -18 to +18.
- **gain** per layer: 0.03–0.095; keep combined energy modest.
- **lowpassHz**: 450–4200 (lower = darker/muffled).
- **lowpassQ**: 0.35–1.25.
- **masterPeak**: 0.12–0.30 (quiet laptop listening).
- **swellSeconds**: 3–10 (fade-in length in seconds).
- **filterSweepToHz**: number 600–5200 to open the filter slightly over the swell, or null to omit.
- No medical, crisis, or diagnostic language—only tone and atmosphere.`;

function clampAmbience(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.min(hi, Math.max(lo, x));
}

function fallbackMoodAmbienceFromPrompt(mood) {
  const m = String(mood || "").toLowerCase();
  let layers = [
    { waveform: "sine", frequencyHz: 98, detuneCents: -6, gain: 0.055 },
    { waveform: "sine", frequencyHz: 147, detuneCents: 3, gain: 0.048 },
    { waveform: "triangle", frequencyHz: 196, detuneCents: -2, gain: 0.032 },
  ];
  let lowpassHz = 920;
  let lowpassQ = 0.8;
  let masterPeak = 0.2;
  let swellSeconds = 5.5;
  let filterSweepToHz = 1500;
  let title = "Quiet harbor";
  let description = "A gentle local-only tone stack—soft thirds with room to breathe.";

  if (/anxious|wired|restless|overwhelm|racing|frazzled/.test(m)) {
    title = "Slowing the static";
    description = "Breathing room in the highs—steady partials without an edge.";
    layers = [
      { waveform: "sine", frequencyHz: 164, detuneCents: 5, gain: 0.042 },
      { waveform: "sine", frequencyHz: 206, detuneCents: -4, gain: 0.04 },
      { waveform: "triangle", frequencyHz: 258, detuneCents: 2, gain: 0.034 },
    ];
    lowpassHz = 1400;
    filterSweepToHz = 2200;
    masterPeak = 0.18;
  } else if (/sleep|tired|exhaust|dream|night|insomnia/.test(m)) {
    title = "Almost moon";
    description = "Low, slow waves for settling without sharp edges.";
    layers = [
      { waveform: "sine", frequencyHz: 72, detuneCents: -3, gain: 0.05 },
      { waveform: "sine", frequencyHz: 108, detuneCents: 2, gain: 0.045 },
      { waveform: "sine", frequencyHz: 162, detuneCents: -5, gain: 0.035 },
    ];
    lowpassHz = 560;
    filterSweepToHz = 780;
    swellSeconds = 7;
  } else if (/joy|bright|hope|light|energized|grateful|celebrate/.test(m)) {
    title = "Warm noon haze";
    description = "Lifted intervals and a soft shimmer—bright but not piercing.";
    layers = [
      { waveform: "sine", frequencyHz: 131, detuneCents: -2, gain: 0.05 },
      { waveform: "sine", frequencyHz: 196, detuneCents: 4, gain: 0.045 },
      { waveform: "triangle", frequencyHz: 262, detuneCents: -3, gain: 0.036 },
    ];
    lowpassHz = 1800;
    filterSweepToHz = 2800;
  } else if (/grief|sad|heavy|lonely|lost|melanchol/.test(m)) {
    title = "Low tide";
    description = "Grounded tones with space for weight—no rush to fix anything.";
    layers = [
      { waveform: "sine", frequencyHz: 65, detuneCents: -2, gain: 0.052 },
      { waveform: "sine", frequencyHz: 98, detuneCents: 1, gain: 0.048 },
      { waveform: "triangle", frequencyHz: 155, detuneCents: -6, gain: 0.03 },
    ];
    lowpassHz = 620;
    filterSweepToHz = 900;
    swellSeconds = 7.5;
  } else if (/focus|work|study|clarity|concentrat|steady/.test(m)) {
    title = "Clear bench";
    description = "Minimal beating—a calm backdrop for attention.";
    layers = [
      { waveform: "sine", frequencyHz: 110, detuneCents: 0, gain: 0.052 },
      { waveform: "sine", frequencyHz: 165, detuneCents: -5, gain: 0.042 },
      { waveform: "sine", frequencyHz: 220, detuneCents: 4, gain: 0.034 },
    ];
    lowpassHz = 1100;
    filterSweepToHz = 1600;
  }

  return {
    title,
    description,
    layers,
    lowpassHz,
    lowpassQ,
    masterPeak,
    swellSeconds,
    filterSweepToHz,
  };
}

function normalizeMoodAmbienceSpec(raw, moodForFallback) {
  const fb = fallbackMoodAmbienceFromPrompt(moodForFallback);
  if (!raw || typeof raw !== "object") return fb;

  const title =
    typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim().replace(/\s+/g, " ").slice(0, 44)
      : fb.title;
  const description =
    typeof raw.description === "string" && raw.description.trim()
      ? raw.description.trim().replace(/\s+/g, " ").slice(0, 180)
      : fb.description;

  const arr = Array.isArray(raw.layers) ? raw.layers : [];
  const layers = [];
  for (let i = 0; i < arr.length && layers.length < 4; i++) {
    const L = arr[i];
    if (!L || typeof L !== "object") continue;
    const wf = String(L.waveform || "sine").toLowerCase() === "triangle" ? "triangle" : "sine";
    const frequencyHz = clampAmbience(L.frequencyHz, 55, 380);
    const detuneCents = clampAmbience(L.detuneCents, -22, 22);
    const gain = clampAmbience(L.gain, 0.028, 0.1);
    layers.push({ waveform: wf, frequencyHz, detuneCents, gain });
  }
  if (layers.length < 2) {
    return fb;
  }
  while (layers.length < 3) {
    const pad = fb.layers[layers.length % fb.layers.length];
    layers.push({ ...pad });
  }

  const lowpassHz = clampAmbience(raw.lowpassHz, 400, 5200);
  const lowpassQ = clampAmbience(raw.lowpassQ, 0.25, 2.5);
  const masterPeak = clampAmbience(raw.masterPeak, 0.1, 0.32);
  const swellSeconds = clampAmbience(raw.swellSeconds, 2.5, 12);
  let filterSweepToHz = fb.filterSweepToHz;
  if (raw.filterSweepToHz != null && raw.filterSweepToHz !== "") {
    filterSweepToHz = clampAmbience(raw.filterSweepToHz, 500, 8000);
  }

  const gainSum = layers.reduce((a, L) => a + L.gain, 0);
  if (gainSum > 0.22) {
    const scale = 0.22 / gainSum;
    for (const L of layers) {
      L.gain = clampAmbience(L.gain * scale, 0.025, 0.1);
    }
  }

  return {
    title,
    description,
    layers,
    lowpassHz,
    lowpassQ,
    masterPeak,
    swellSeconds,
    filterSweepToHz,
  };
}

function appendChatTurn(db, sessionId, userContent, assistantContent, suggestions) {
  maybeAutotitleSession(db, sessionId, userContent);
  const ins = db.prepare(
    "INSERT INTO chat_messages (session_id, role, content, suggestions_json) VALUES (?, ?, ?, ?)"
  );
  const sugJson =
    Array.isArray(suggestions) && suggestions.length > 0 ? JSON.stringify(suggestions) : null;
  const touch = db.prepare("UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?");
  const tx = db.transaction(() => {
    ins.run(sessionId, "user", String(userContent ?? ""), null);
    ins.run(sessionId, "assistant", String(assistantContent ?? ""), sugJson);
    touch.run(sessionId);
  });
  tx();
}

export function createApp(options = {}) {
  const dataDir = options.dataDir ?? DATA_DIR;
  const db = options.db ?? (() => {
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    return openDatabase(dataDir);
  })();

  migrate(db);

  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/notes", (req, res) => {
    const q = typeof req.query?.q === "string" ? req.query.q : "";
    const rows = q.trim()
      ? searchNotesFullText(db, q, 100)
      : db.prepare("SELECT * FROM notes ORDER BY updated_at DESC, id DESC").all();
    res.json(rows);
  });

  app.post("/api/notes", async (req, res) => {
    const rawTitle = String(req.body?.title ?? "").trim();
    const body = String(req.body?.body ?? "");
    const title = rawTitle || (await generateNoteTitle(body));
    const titleAuto = rawTitle ? 0 : 1;
    const sourceSessionId = req.body?.sourceSessionId;
    const sid = Number.isFinite(Number(sourceSessionId)) ? Number(sourceSessionId) : null;
    const noteType = String(req.body?.noteType ?? "general") || "general";
    const r = db
      .prepare(
        "INSERT INTO notes (title, body, source_session_id, note_type, title_auto) VALUES (?, ?, ?, ?, ?) RETURNING *"
      )
      .get(title, body, sid, noteType, titleAuto);
    if (getSetting(db, "stats_opt_in", "0") === "1") {
      db.prepare("INSERT INTO app_events (event_type) VALUES ('journal_entry')").run();
    }
    res.status(201).json(r);
  });

  app.patch("/api/notes/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const cur = db.prepare("SELECT * FROM notes WHERE id = ?").get(id);
    if (!cur) return res.status(404).json({ error: "Not found" });
    const body = req.body?.body !== undefined ? String(req.body.body) : cur.body;
    let title = req.body?.title !== undefined ? String(req.body.title).trim() : String(cur.title || "");
    let titleAuto = cur.title_auto ? 1 : 0;
    if (!title) {
      title = await generateNoteTitle(body);
      titleAuto = 1;
    } else if (req.body?.title !== undefined) {
      titleAuto = 0;
    }
    const noteType =
      req.body?.noteType !== undefined
        ? String(req.body.noteType)
        : cur.note_type != null
          ? String(cur.note_type)
          : "general";
    const r = db
      .prepare(
        "UPDATE notes SET title = ?, body = ?, note_type = ?, title_auto = ?, updated_at = datetime('now') WHERE id = ? RETURNING *"
      )
      .get(title, body, noteType, titleAuto, id);
    res.json(r);
  });

  app.delete("/api/notes/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const r = db.prepare("DELETE FROM notes WHERE id = ?").run(id);
    if (r.changes === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  });

  app.post("/api/daily-habits/generate", async (req, res) => {
    const includeNotes = req.body?.includeNotes !== false;
    const notesLimit = Number.isFinite(Number(req.body?.notesLimit))
      ? Math.min(12, Math.max(0, Number(req.body.notesLimit)))
      : 6;
    const noteBlocks = includeNotes ? collectRecentNotesForHabits(db, notesLimit) : [];
    const userContent = buildDailyHabitsUserMessage(ymdLocal(), noteBlocks);
    const openaiFormat = [
      { role: "system", content: DAILY_HABITS_SYSTEM },
      { role: "user", content: userContent },
    ];

    try {
      const text = await aiProvider.complete(openaiFormat, {
        temperature: 0.65,
        timeoutMs: 120_000,
      });
      return res.json({ content: text });
    } catch (e) {
      return res.status(502).json({
        error: String(e?.message || e),
        hint: "Is Ollama running? Try: ollama pull " + OLLAMA_MODEL,
      });
    }
  });

  app.post("/api/chat/reflection/generate", async (_req, res) => {
    const stats = collectChatHistoryForReflection(db);
    const openaiFormat = [
      { role: "system", content: CHAT_REFLECTION_SYSTEM },
      { role: "user", content: buildChatReflectionUserMessage(stats) },
    ];
    try {
      const content = await aiProvider.complete(openaiFormat, {
        temperature: 0.55,
        timeoutMs: 120_000,
      });
      const clean = String(content || "").trim();
      if (!clean) {
        return res.json({ content: fallbackChatReflection(stats), stats });
      }
      return res.json({ content: clean, stats });
    } catch {
      return res.json({ content: fallbackChatReflection(stats), stats, fallback: true });
    }
  });

  app.post("/api/weekly-review/generate", async (_req, res) => {
    const ctx = collectWeeklyContext(db);
    const openaiFormat = [
      { role: "system", content: WEEKLY_REVIEW_SYSTEM },
      { role: "user", content: buildWeeklyReviewUserMessage(ctx) },
    ];
    try {
      const content = await aiProvider.complete(openaiFormat, {
        temperature: 0.58,
        timeoutMs: 120_000,
      });
      const clean = String(content || "").trim();
      if (!clean) return res.json({ content: fallbackWeeklyReview(ctx), stats: ctx, fallback: true });
      return res.json({ content: clean, stats: ctx });
    } catch {
      return res.json({ content: fallbackWeeklyReview(ctx), stats: ctx, fallback: true });
    }
  });

  app.post("/api/insights/generate", async (_req, res) => {
    const ctx = collectInsightsContext(db);
    const metrics = buildInsightsMetrics(ctx);
    const openaiFormat = [
      { role: "system", content: INSIGHTS_SYSTEM },
      { role: "user", content: buildInsightsUserMessage(ctx) },
    ];
    try {
      const content = await aiProvider.complete(openaiFormat, {
        temperature: 0.52,
        timeoutMs: 120_000,
      });
      const clean = String(content || "").trim();
      if (!clean) return res.json({ content: fallbackInsights(ctx), stats: ctx, metrics, fallback: true });
      return res.json({ content: clean, stats: ctx, metrics });
    } catch {
      return res.json({ content: fallbackInsights(ctx), stats: ctx, metrics, fallback: true });
    }
  });

  app.post("/api/horoscope/daily", async (req, res) => {
    const birthRaw = req.body?.birthDate;
    const birthParsed = parseBirthDateString(birthRaw);
    if (!birthParsed) {
      return res.status(400).json({
        error: "birthDate is required (YYYY-MM-DD)",
        hint: "Use an ISO calendar date",
      });
    }
    const birthYmd = `${birthParsed.y}-${String(birthParsed.mo).padStart(2, "0")}-${String(birthParsed.da).padStart(2, "0")}`;
    const readingDateParsed =
      typeof req.body?.readingDate === "string" ? parseBirthDateString(req.body.readingDate) : null;
    const readingAt = readingDateParsed
      ? new Date(Date.UTC(readingDateParsed.y, readingDateParsed.mo - 1, readingDateParsed.da, 12, 0, 0))
      : new Date();
    const facts = computeHoroscopeAstronomy(birthYmd, readingAt);
    if (!facts) {
      return res.status(400).json({ error: "Invalid birth date" });
    }
    const birthTime =
      typeof req.body?.birthTime === "string" ? String(req.body.birthTime).trim().slice(0, 32) : "";
    const birthPlace =
      typeof req.body?.birthPlace === "string" ? String(req.body.birthPlace).trim().slice(0, 120) : "";

    const userMsg = (() => {
      let u = `Generate today's entertainment horoscope JSON.\n\n`;
      u += `Reading date (for thematic flavor): ${ymdLocal(readingAt)}\n`;
      u += `User birth date: ${birthYmd}\n`;
      if (birthTime) u += `Birth time (optional context only): ${birthTime}\n`;
      if (birthPlace) u += `Birth place (display/context only): ${birthPlace}\n`;
      u += `\nPrecomputed symbolic facts (approximate; use as flavor only):\n`;
      u += `- Tropical sun sign from birth date: ${facts.sunSign}\n`;
      u += `- Approximate moon sign now: ${facts.moonSignApprox}\n`;
      u += `- Moon phase (approximate label): ${facts.moonPhase}\n`;
      u += `- Moon illumination (approximate): ${facts.moonIlluminationPercent}%\n`;
      return u;
    })();

    const openaiFormat = [
      { role: "system", content: HOROSCOPE_DAILY_SYSTEM },
      { role: "user", content: userMsg },
    ];

    try {
      const text = await aiProvider.complete(openaiFormat, {
        temperature: 0.62,
        timeoutMs: 90_000,
      });
      const parsed = parseJsonObjectFromModelText(text);
      if (
        parsed &&
        typeof parsed === "object" &&
        (Array.isArray(parsed.love) || Array.isArray(parsed.career) || Array.isArray(parsed.personal))
      ) {
        return res.json(mergeHoroscopeResponse(facts, parsed, false));
      }
      return res.json(mergeHoroscopeResponse(facts, null, true));
    } catch {
      return res.json(mergeHoroscopeResponse(facts, null, true));
    }
  });

  app.post("/api/ambience/generate", async (req, res) => {
    const mood = String(req.body?.mood ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 480);
    if (!mood) {
      return res.status(400).json({
        error: "mood is required",
        hint: "Send a short phrase: how you feel or what atmosphere you want (e.g. “rainy evening, cozy focus”).",
      });
    }
    const userMsg = `Mood / atmosphere request:\n${mood}\n\nDesign the JSON patch for browser synthesis as specified in your system rules.`;
    const openaiFormat = [
      { role: "system", content: AMBIENCE_MOOD_SYSTEM },
      { role: "user", content: userMsg },
    ];
    try {
      const text = await aiProvider.complete(openaiFormat, {
        temperature: 0.55,
        timeoutMs: 75_000,
      });
      const parsed = parseJsonObjectFromModelText(text);
      const spec = normalizeMoodAmbienceSpec(parsed, mood);
      const modelGaveLayers =
        parsed &&
        typeof parsed === "object" &&
        Array.isArray(parsed.layers) &&
        parsed.layers.filter((x) => x && typeof x === "object" && Number.isFinite(Number(x.frequencyHz)))
          .length >= 2;
      if (spec && Array.isArray(spec.layers) && spec.layers.length >= 2) {
        return res.json({ spec, fallback: !modelGaveLayers });
      }
    } catch {
      /* use template */
    }
    return res.json({ spec: fallbackMoodAmbienceFromPrompt(mood), fallback: true });
  });

  // Optional browse list (same names as before); selection APIs are not limited to this list.
  app.get("/api/teachers", (_req, res) => {
    res.json(TEACHER_AGENT_CATALOG.map((name, idx) => ({ id: idx + 1, name })));
  });

  app.post("/api/teachers/recommend", async (_req, res) => {
    const ctx = collectInsightsContext(db);
    const openaiFormat = [
      { role: "system", content: TEACHER_GUIDANCE_SYSTEM },
      { role: "user", content: buildTeacherRecommendationUserMessage(ctx) },
    ];
    try {
      const raw = await aiProvider.complete(openaiFormat, {
        temperature: 0.62,
        timeoutMs: 120_000,
      });
      const parsed = parseJsonObjectFromModelText(raw);
      const teacher = sanitizeFigureLabel(parsed?.teacher);
      if (!parsed || !teacher) {
        const fb = fallbackTeacherGuidance(ctx);
        return res.json({
          ...fb,
          fallback: true,
          reason: "model_response_parse_failed",
          teacherListSize: TEACHER_AGENT_CATALOG.length,
        });
      }
      return res.json({
        teacher,
        why: String(parsed?.why || "").trim(),
        guidance: String(parsed?.guidance || "").trim(),
        mantra: String(parsed?.mantra || "").trim(),
        teacherListSize: TEACHER_AGENT_CATALOG.length,
      });
    } catch {
      const fb = fallbackTeacherGuidance(ctx);
      return res.json({
        ...fb,
        fallback: true,
        reason: "ai_unavailable",
        teacherListSize: TEACHER_AGENT_CATALOG.length,
      });
    }
  });

  app.post("/api/teachers/build-agent", async (req, res) => {
    try {
      const situation = String(req.body?.situation ?? "").trim();
      const rawFromNotes = req.body?.fromNotes;
      const fromNotes =
        rawFromNotes === true ||
        rawFromNotes === 1 ||
        (typeof rawFromNotes === "string" &&
          ["true", "1", "yes", "on"].includes(String(rawFromNotes).toLowerCase()));
      if (!situation && !fromNotes) {
        return res.status(400).json({ error: "Provide situation text and/or set fromNotes to true" });
      }
      const noteBlocks = fromNotes ? collectRecentNotesForHabits(db, 14) : [];
      if (fromNotes && noteBlocks.length === 0) {
        return res.status(400).json({
          error: "No journal notes found; add a note first or describe your situation without fromNotes.",
        });
      }
      const maxPromptChars = Math.min(AGENT_PROMPT_MAX - 500, 3200);
      const userMsg = buildTeacherAgentFromSituationUserMessage({ situation, noteBlocks, maxPromptChars });
      const openaiFormat = [
        { role: "system", content: TEACHER_AGENT_BUILD_SYSTEM },
        { role: "user", content: userMsg },
      ];
      function insertCustomAgentRow(name, prompt) {
        const n = String(name || "").trim().slice(0, AGENT_NAME_MAX);
        const p = String(prompt || "").trim().slice(0, AGENT_PROMPT_MAX);
        if (!n || !p) {
          return { row: null, error: "Could not save guide (missing name or prompt)" };
        }
        try {
          const row = db
            .prepare(
              "INSERT INTO custom_agents (name, system_prompt) VALUES (?, ?) RETURNING id, name, system_prompt, created_at, updated_at"
            )
            .get(n, p);
          if (!row) {
            return { row: null, error: "Could not save guide (database returned no row)" };
          }
          return { row, error: null };
        } catch (e) {
          return { row: null, error: String(e?.message || e) };
        }
      }
      try {
        const raw = await aiProvider.complete(openaiFormat, {
          temperature: 0.66,
          timeoutMs: 120_000,
        });
        const parsed = parseJsonObjectFromModelText(raw);
        const figure = sanitizeFigureLabel(parsed?.figure);
        const whyFit = String(parsed?.whyFit ?? "").trim();
        let agentName = String(parsed?.agentName ?? "").trim().slice(0, AGENT_NAME_MAX);
        let systemPrompt = String(parsed?.systemPrompt ?? "").trim().slice(0, AGENT_PROMPT_MAX);
        // Fallback when: JSON parse failed upstream, missing figure, fenced junk in prompt, or prompt too thin.
        const MIN_AGENT_PROMPT = 80;
        const ok =
          figure &&
          systemPrompt.length >= MIN_AGENT_PROMPT &&
          systemPrompt.length <= AGENT_PROMPT_MAX &&
          !/```/.test(systemPrompt);
        if (!ok) {
          const fb = fallbackTeacherAgentBuild({ situation, noteBlocks });
          const ins = insertCustomAgentRow(fb.agentName, fb.systemPrompt);
          if (!ins.row) {
            return res.status(500).json({ error: ins.error || "Could not save guide" });
          }
          return res.status(201).json({
            agent: ins.row,
            figure: fb.figure,
            whyFit: fb.whyFit,
            fallback: true,
            reason: "model_parse_or_validation_failed",
          });
        }
        if (!agentName) {
          agentName = `Guide · ${figure}`.slice(0, AGENT_NAME_MAX);
        }
        const ins = insertCustomAgentRow(agentName, systemPrompt);
        if (!ins.row) {
          return res.status(500).json({ error: ins.error || "Could not save guide" });
        }
        return res.status(201).json({
          agent: ins.row,
          figure,
          whyFit:
            whyFit ||
            `This voice may fit what you shared; treat it as a starting lens around themes often associated with ${figure}.`,
          fallback: false,
        });
      } catch (modelErr) {
        const fb = fallbackTeacherAgentBuild({ situation, noteBlocks });
        const ins = insertCustomAgentRow(fb.agentName, fb.systemPrompt);
        if (!ins.row) {
          const modelMsg = String(modelErr?.message || modelErr);
          return res.status(500).json({
            error: [ins.error, modelMsg].filter(Boolean).join(" — ") || "Could not save guide",
            hint:
              "If the API is unreachable, start the backend (e.g. `npm run dev` runs API on port 3001) and ensure Ollama is running if you use CHAT_MODE=ollama.",
          });
        }
        return res.status(201).json({
          agent: ins.row,
          figure: fb.figure,
          whyFit: fb.whyFit,
          fallback: true,
          reason: "ai_unavailable",
        });
      }
    } catch (e) {
      return res.status(500).json({ error: String(e?.message || e) || "Unexpected server error" });
    }
  });

  app.get("/api/agents", (_req, res) => {
    const rows = selectAgentRows(db).sort((a, b) => {
      const byDate = String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
      return byDate !== 0 ? byDate : Number(b.id) - Number(a.id);
    });
    res.json(rows.map(agentResponse));
  });

  app.post("/api/agents", (req, res) => {
    const name = String(req.body?.name ?? "").trim().slice(0, AGENT_NAME_MAX);
    if (!name) {
      return res.status(400).json({ error: "name required" });
    }
    const legacyPrompt = String(req.body?.systemPrompt ?? "").trim().slice(0, AGENT_PROMPT_MAX);
    if (!legacyPrompt && !hasStructuredGuideInput(req.body)) {
      return res.status(400).json({ error: "systemPrompt required" });
    }
    const { guide, db: guideDb } = serializeGuideForDb({
      ...req.body,
      name,
      customInstructions: req.body?.customInstructions ?? legacyPrompt,
    });
    if (guide.isActive) {
      db.prepare("UPDATE custom_agents SET is_active = 0").run();
    }
    const r = db
      .prepare(
        `INSERT INTO custom_agents (
          name, system_prompt, short_description, role_purpose, tone, speaking_style,
          encouragement_style, focus_areas_json, boundaries_json, context_access_json,
          behavior_tuning_json, custom_instructions, is_active
        ) VALUES (
          @name, @system_prompt, @short_description, @role_purpose, @tone, @speaking_style,
          @encouragement_style, @focus_areas_json, @boundaries_json, @context_access_json,
          @behavior_tuning_json, @custom_instructions, @is_active
        ) RETURNING id, name, system_prompt, short_description, role_purpose, tone, speaking_style,
          encouragement_style, focus_areas_json, boundaries_json, context_access_json,
          behavior_tuning_json, custom_instructions, is_active, created_at, updated_at`
      )
      .get(guideDb);
    res.status(201).json(agentResponse(r));
  });

  app.patch("/api/agents/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const cur = selectAgentRow(db, id);
    if (!cur) return res.status(404).json({ error: "Not found" });
    const next = {
      ...cur,
      ...req.body,
      name: req.body?.name !== undefined ? String(req.body.name).trim().slice(0, AGENT_NAME_MAX) : cur.name,
      customInstructions:
        req.body?.customInstructions ?? req.body?.systemPrompt ?? req.body?.custom_instructions ?? cur.custom_instructions,
    };
    if (!String(next.name || "").trim()) {
      return res.status(400).json({ error: "name required" });
    }
    const { guide, db: guideDb } = serializeGuideForDb(next, cur);
    if (guide.isActive) {
      db.prepare("UPDATE custom_agents SET is_active = 0 WHERE id != ?").run(id);
    }
    const r = db
      .prepare(
        `UPDATE custom_agents
         SET name = @name,
             system_prompt = @system_prompt,
             short_description = @short_description,
             role_purpose = @role_purpose,
             tone = @tone,
             speaking_style = @speaking_style,
             encouragement_style = @encouragement_style,
             focus_areas_json = @focus_areas_json,
             boundaries_json = @boundaries_json,
             context_access_json = @context_access_json,
             behavior_tuning_json = @behavior_tuning_json,
             custom_instructions = @custom_instructions,
             is_active = @is_active,
             updated_at = datetime('now')
         WHERE id = @id
         RETURNING id, name, system_prompt, short_description, role_purpose, tone, speaking_style,
           encouragement_style, focus_areas_json, boundaries_json, context_access_json,
           behavior_tuning_json, custom_instructions, is_active, created_at, updated_at`
      )
      .get({ ...guideDb, id });
    res.json(agentResponse(r));
  });

  app.delete("/api/agents/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const r = db.prepare("DELETE FROM custom_agents WHERE id = ?").run(id);
    if (r.changes === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  });

  app.post("/api/agents/chat", async (req, res) => {
    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages[] required" });
    }
    const lastUser = messages[messages.length - 1];
    if (!lastUser || String(lastUser.role || "").toLowerCase() !== "user") {
      return res.status(400).json({ error: "Last message must be from the user" });
    }

    const agentId = Number(req.body?.agentId);
    const messageTail = messages.slice(-24).map((m) => ({
      role: String(m.role || "").toLowerCase() === "assistant" ? "assistant" : "user",
      content: String(m.content ?? ""),
    }));
    const depthMode = guideDepthModeForMessages(messageTail);

    let systemPrompt = "";
    let fallbackGuide = null;
    if (Number.isFinite(agentId) && agentId > 0) {
      const row = selectAgentRow(db, agentId);
      if (!row) return res.status(404).json({ error: "Agent not found" });
      const guide = normalizeGuide(row);
      fallbackGuide = guide;
      systemPrompt = buildGuideSystemPrompt(guide, {
        userAppContext: buildAgentAppContext(db, guide),
        depthMode,
      });
    } else {
      const personaPrompt = String(req.body?.systemPrompt ?? "").trim().slice(0, AGENT_PROMPT_MAX);
      if (personaPrompt) {
        systemPrompt = buildAgentSystemPrompt(personaPrompt, messageTail);
      } else if (hasStructuredGuideInput(req.body)) {
        const guide = normalizeGuide(req.body);
        fallbackGuide = guide;
        systemPrompt = buildGuideSystemPrompt(guide, { depthMode });
      } else {
        return res.status(400).json({ error: "agentId or non-empty systemPrompt required" });
      }
    }

    const openaiFormat = [{ role: "system", content: systemPrompt }, ...messageTail];

    if (getSetting(db, "stats_opt_in", "0") === "1") {
      db.prepare("INSERT INTO app_events (event_type) VALUES ('agent_chat_turn')").run();
    }

    try {
      const text = await aiProvider.complete(openaiFormat, { temperature: 0.58, timeoutMs: 120_000 });
      const clean = String(text ?? "").trim();
      if (!clean) {
        return res.status(502).json({ error: "Empty model response" });
      }
      return res.json({ role: "assistant", content: clean });
    } catch (e) {
      if (fallbackGuide) {
        return res.json({
          role: "assistant",
          content: buildGuideFallbackResponse(fallbackGuide, String(lastUser.content || "")),
          fallback: true,
        });
      }
      return res.status(502).json({
        error: String(e?.message || e),
        hint: "Is Ollama running? Try: ollama pull " + OLLAMA_MODEL,
      });
    }
  });

  app.post("/api/practices/generate-from-chat", async (req, res) => {
    const sessionId = Number(req.body?.sessionId);
    if (!Number.isFinite(sessionId)) {
      return res.status(400).json({ error: "sessionId required" });
    }
    const session = db.prepare("SELECT id, title FROM chat_sessions WHERE id = ?").get(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const turns = collectSessionTurnsForPractice(db, sessionId);
    if (turns.length === 0) {
      return res.status(400).json({ error: "No chat history in this session yet" });
    }

    const buildPracticePrompt = () => {
      let msg =
        "Create one concise meditation/reflection practice based on this chat context. Output JSON only with keys: title, summary, category, tags, est_minutes.\n";
      msg +=
        'Rules: title <= 50 chars, summary 2-5 lines plain text, category one word, tags array 2-5 short lowercase tags, est_minutes integer 3-20.\n\n';
      turns.forEach((t, i) => {
        msg += `${i + 1}. ${t.role.toUpperCase()}: ${t.content}\n`;
      });
      return msg;
    };

    const openaiFormat = [
      {
        role: "system",
        content:
          "You design brief, safe, non-clinical meditation practices. Respond in strict JSON only, no markdown fences.",
      },
      { role: "user", content: buildPracticePrompt() },
    ];

    let parsed = null;
    try {
      const raw = await aiProvider.complete(openaiFormat, { temperature: 0.45, timeoutMs: 120_000 });
      const clean = String(raw || "").trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
      parsed = JSON.parse(clean);
    } catch {
      parsed = fallbackGeneratedPractice(turns);
    }

    const title = String(parsed?.title || "").trim().slice(0, 80) || fallbackGeneratedPractice(turns).title;
    const summary = String(parsed?.summary || "").trim().slice(0, 2400) || fallbackGeneratedPractice(turns).summary;
    const category = String(parsed?.category || "generated").trim().slice(0, 40) || "generated";
    const tagsRaw = Array.isArray(parsed?.tags) ? parsed.tags : fallbackGeneratedPractice(turns).tags;
    const tags = tagsRaw
      .map((t) => String(t || "").trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8);
    if (!tags.includes("generated")) tags.unshift("generated");
    const estMinutesNum = Number(parsed?.est_minutes);
    const estMinutes = Number.isFinite(estMinutesNum) ? Math.min(30, Math.max(3, Math.round(estMinutesNum))) : 8;

    const maxO = db.prepare("SELECT IFNULL(MAX(sort_order), -1) + 1 AS o FROM practices").get().o;
    const row = db
      .prepare(
        "INSERT INTO practices (title, summary, category, sort_order, tags, est_minutes) VALUES (?, ?, ?, ?, ?, ?) RETURNING *"
      )
      .get(title, summary, category, maxO, JSON.stringify(tags), estMinutes);

    let rowTags = [];
    try {
      rowTags = row.tags ? JSON.parse(row.tags) : [];
    } catch {
      rowTags = [];
    }
    return res.status(201).json({
      ...row,
      tags: Array.isArray(rowTags) ? rowTags : [],
      generated_from_session_id: sessionId,
    });
  });

  app.get("/api/practices", (req, res) => {
    const tagQ = typeof req.query?.tag === "string" ? req.query.tag.toLowerCase().trim() : "";
    const timeQ = req.query?.maxMinutes;
    const maxM = timeQ != null && timeQ !== "" ? Number(timeQ) : null;
    let rows = db
      .prepare(
        `SELECT p.*,
         EXISTS (SELECT 1 FROM practice_favorites f WHERE f.practice_id = p.id) AS is_favorite
         FROM practices p ORDER BY p.sort_order ASC, p.id ASC`
      )
      .all();
    if (maxM != null && Number.isFinite(maxM) && maxM > 0) {
      rows = rows.filter((r) => (r.est_minutes != null ? r.est_minutes : 10) <= maxM);
    }
    if (tagQ) {
      rows = rows.filter((r) => {
        let tags = [];
        try {
          tags = r.tags ? JSON.parse(r.tags) : [];
        } catch {
          tags = [];
        }
        const tline = (tags || []).map((t) => String(t).toLowerCase());
        if (tline.includes(tagQ)) return true;
        if (String(r.title || "")
          .toLowerCase()
          .includes(tagQ)) return true;
        if (String(r.category || "")
          .toLowerCase()
          .includes(tagQ)) return true;
        if (String(r.summary || "")
          .toLowerCase()
          .includes(tagQ)) return true;
        return false;
      });
    }
    res.json(
      rows.map((r) => {
        let tags;
        try {
          tags = r.tags ? JSON.parse(r.tags) : [];
        } catch {
          tags = [];
        }
        return {
          ...r,
          tags: Array.isArray(tags) ? tags : [],
          is_favorite: Boolean(r.is_favorite),
        };
      })
    );
  });

  app.post("/api/practices/:id/favorite", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const p = db.prepare("SELECT 1 as x FROM practices WHERE id = ?").get(id);
    if (!p) return res.status(404).json({ error: "Not found" });
    db.prepare("INSERT OR REPLACE INTO practice_favorites (practice_id) VALUES (?)").run(id);
    res.json({ ok: true });
  });

  app.delete("/api/practices/:id/favorite", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    db.prepare("DELETE FROM practice_favorites WHERE practice_id = ?").run(id);
    res.json({ ok: true });
  });

  app.get("/api/preferences", (_req, res) => {
    res.json({
      intention: getSetting(db, "intention", "") || "",
      statsOptIn: getSetting(db, "stats_opt_in", "0") === "1",
      streak: Number(getSetting(db, "streak", "0")) || 0,
    });
  });

  app.put("/api/preferences", (req, res) => {
    if (req.body?.intention != null) {
      setSetting(db, "intention", String(req.body.intention).slice(0, 2000));
    }
    if (req.body?.statsOptIn != null) {
      setSetting(db, "stats_opt_in", req.body.statsOptIn ? "1" : "0");
    }
    res.json({
      intention: getSetting(db, "intention", "") || "",
      statsOptIn: getSetting(db, "stats_opt_in", "0") === "1",
      streak: Number(getSetting(db, "streak", "0")) || 0,
    });
  });

  app.post("/api/activity/visit", (_req, res) => {
    if (getSetting(db, "stats_opt_in", "0") !== "1") {
      return res.json({ ok: true, skipped: true, streak: 0 });
    }
    const today = ymdLocal();
    const yYesterday = prevYmd(today);
    const lastYmd = getSetting(db, "last_visit_ymd", "");
    let prior = Number(getSetting(db, "streak", "0")) || 0;
    if (lastYmd === today) {
      return res.json({ ok: true, skipped: true, streak: prior, alreadyToday: true });
    }
    let streak;
    if (lastYmd === yYesterday) {
      streak = prior + 1;
    } else {
      streak = 1;
    }
    setSetting(db, "last_visit_ymd", today);
    setSetting(db, "streak", String(streak));
    db.prepare("INSERT INTO app_events (event_type) VALUES ('app_open')").run();
    res.json({ ok: true, streak });
  });

  app.get("/api/home", (_req, res) => {
    const lastNote = db
      .prepare("SELECT * FROM notes ORDER BY updated_at DESC, id DESC LIMIT 1")
      .get();
    const lastLine =
      lastNote && lastNote.body
        ? String(lastNote.body)
            .trim()
            .split("\n")
            .filter(Boolean)
            .slice(-1)[0] || ""
        : "";
    const lastSession = db
      .prepare("SELECT * FROM chat_sessions ORDER BY updated_at DESC, id DESC LIMIT 1")
      .get();
    const lastUserMsg = lastSession
      ? db
          .prepare(
            "SELECT content FROM chat_messages WHERE session_id = ? AND role = 'user' ORDER BY id DESC LIMIT 1"
          )
          .get(lastSession.id)
      : null;
    const suggested = pickSuggestedPractice(
      db,
      lastUserMsg ? lastUserMsg.content : "",
      lastSession ? lastSession.title : ""
    );
    const gratitudeCount = db
      .prepare("SELECT COUNT(*) as c FROM notes WHERE note_type = 'gratitude'")
      .get().c;
    res.json({
      intention: getSetting(db, "intention", "") || "",
      statsOptIn: getSetting(db, "stats_opt_in", "0") === "1",
      streak: Number(getSetting(db, "streak", "0")) || 0,
      lastNote: lastNote
        ? {
            id: lastNote.id,
            title: lastNote.title,
            lastLine,
            note_type: lastNote.note_type,
            updated_at: lastNote.updated_at,
          }
        : null,
      lastSession: lastSession
        ? { id: lastSession.id, title: lastSession.title, updated_at: lastSession.updated_at }
        : null,
      suggestedPractice: suggested,
      gratitudeCount,
    });
  });

  app.get("/api/privacy/export", (_req, res) => {
    const data = {
      exported_at: new Date().toISOString(),
      notes: db.prepare("SELECT * FROM notes ORDER BY id ASC").all(),
      practices: db.prepare("SELECT * FROM practices ORDER BY sort_order ASC, id ASC").all(),
      practice_favorites: db.prepare("SELECT * FROM practice_favorites ORDER BY created_at ASC").all(),
      chat_sessions: db.prepare("SELECT * FROM chat_sessions ORDER BY id ASC").all(),
      chat_messages: db.prepare("SELECT * FROM chat_messages ORDER BY id ASC").all(),
      custom_agents: db.prepare("SELECT * FROM custom_agents ORDER BY id ASC").all(),
      app_settings: db.prepare("SELECT * FROM app_settings ORDER BY key ASC").all(),
      app_events: db.prepare("SELECT * FROM app_events ORDER BY id ASC").all(),
    };
    res.setHeader("content-type", "application/json");
    res.json(data);
  });

  app.delete("/api/privacy/delete-all-data", (_req, res) => {
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM notes").run();
      db.prepare("DELETE FROM practice_favorites").run();
      db.prepare("DELETE FROM chat_messages").run();
      db.prepare("DELETE FROM chat_sessions").run();
      db.prepare("DELETE FROM custom_agents").run();
      db.prepare("DELETE FROM app_events").run();
      db.prepare("DELETE FROM app_settings").run();
      db.prepare("INSERT INTO chat_sessions (title) VALUES ('New chat')").run();
    });
    tx();
    res.status(204).end();
  });

  app.get("/api/chat/config", (_req, res) => {
    res.json({
      mode: CHAT_MODE,
      model:
        CHAT_MODE === "ollama"
          ? OLLAMA_MODEL
          : OPENAI_MODEL,
      ollamaUrl: OLLAMA_URL,
      personaPreview: "Presence",
    });
  });

  app.get("/api/chat/sessions", (_req, res) => {
    const rows = db
      .prepare(
        `SELECT s.id, s.title, s.created_at, s.updated_at,
          (SELECT COUNT(*) FROM chat_messages m WHERE m.session_id = s.id) AS message_count
         FROM chat_sessions s
         ORDER BY s.updated_at DESC, s.id DESC`
      )
      .all();
    res.json(rows);
  });

  app.post("/api/chat/sessions", (req, res) => {
    const title = String(req.body?.title ?? "New chat").trim() || "New chat";
    const r = db
      .prepare("INSERT INTO chat_sessions (title) VALUES (?) RETURNING id, title, created_at, updated_at")
      .get(title);
    res.status(201).json(r);
  });

  app.delete("/api/chat/sessions/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const t = db.transaction(() => {
      db.prepare("DELETE FROM chat_messages WHERE session_id = ?").run(id);
      db.prepare("DELETE FROM chat_sessions WHERE id = ?").run(id);
    });
    t();
    res.status(204).end();
  });

  app.get("/api/chat/messages", (req, res) => {
    const sessionId = Number(req.query.sessionId);
    if (!Number.isFinite(sessionId)) {
      return res.status(400).json({ error: "sessionId query parameter required" });
    }
    const exists = db.prepare("SELECT 1 as x FROM chat_sessions WHERE id = ?").get(sessionId);
    if (!exists) {
      return res.status(404).json({ error: "Session not found" });
    }
    const rows = db
      .prepare(
        "SELECT id, role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY id ASC"
      )
      .all(sessionId);
    res.json(
      rows.map((r) => ({
        id: r.id,
        role: r.role,
        content: r.content,
        created_at: r.created_at,
      }))
    );
  });

  app.delete("/api/chat/messages", (req, res) => {
    const sessionId = Number(req.query.sessionId);
    if (!Number.isFinite(sessionId)) {
      return res.status(400).json({ error: "sessionId query parameter required" });
    }
    db.prepare("DELETE FROM chat_messages WHERE session_id = ?").run(sessionId);
    db.prepare("UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?").run(sessionId);
    res.status(204).end();
  });

  app.post("/api/chat", async (req, res) => {
    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages[] required" });
    }

    const sessionId = Number(req.body?.sessionId);
    if (!Number.isFinite(sessionId)) {
      return res.status(400).json({ error: "sessionId required" });
    }
    const sessionRow = db.prepare("SELECT id FROM chat_sessions WHERE id = ?").get(sessionId);
    if (!sessionRow) {
      return res.status(404).json({ error: "Session not found" });
    }

    const lastUser = messages[messages.length - 1];
    if (!lastUser || String(lastUser.role || "").toLowerCase() !== "user") {
      return res.status(400).json({ error: "Last message must be from the user" });
    }

    const relatedId = Number(req.body?.relatedPracticeId);
    let practice = null;
    if (Number.isFinite(relatedId) && relatedId > 0) {
      practice = db
        .prepare("SELECT id, title, summary, category FROM practices WHERE id = ?")
        .get(relatedId);
    }
    const lastUserText = String(lastUser.content ?? "");
    const noteSnippets = searchNotesForRag(db, lastUserText, 2);
    if (getSetting(db, "stats_opt_in", "0") === "1") {
      db.prepare("INSERT INTO app_events (event_type) VALUES ('chat_turn')").run();
    }

    let systemPromptOverride =
      typeof req.body?.systemPrompt === "string" ? String(req.body.systemPrompt).trim() : "";
    const agentIdBody = Number(req.body?.agentId);
    if (Number.isFinite(agentIdBody) && agentIdBody > 0) {
      const row = selectAgentRow(db, agentIdBody);
      if (!row) {
        return res.status(404).json({ error: "Agent not found" });
      }
      const guide = normalizeGuide(row);
      systemPromptOverride = buildGuideSystemPrompt(guide, {
        userAppContext: buildAgentAppContext(db, guide),
        practice,
        noteSnippets,
      });
    }

    const openaiFormat = [
      {
        role: "system",
        content: buildSystemPrompt(messages, {
          practice: systemPromptOverride ? null : practice,
          noteSnippets: systemPromptOverride ? [] : noteSnippets,
          agentSystemPrompt: systemPromptOverride || undefined,
        }),
      },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content ?? ""),
      })),
    ];

    const suggestions = [];

    try {
      const text = await aiProvider.complete(openaiFormat, { temperature: 0.6, timeoutMs: 120_000 });
      appendChatTurn(db, sessionId, String(lastUser.content ?? ""), text, suggestions);
      return res.json({
        role: "assistant",
        content: text,
      });
    } catch (e) {
      return res.status(502).json({
        error: String(e?.message || e),
        hint:
          "Is Ollama running? On Windows, start the Ollama app and try: ollama pull " + OLLAMA_MODEL,
      });
    }
  });

  /* Serve built SPA in production */
  const dist = join(__dirname, "..", "dist");
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api")) {
        return res.status(404).json({ error: "Not found" });
      }
      return res.sendFile(join(dist, "index.html"));
    });
  }

  return { app, db, dataDir };
}

export function startServer(port = PORT) {
  const { app } = createApp();
  return app.listen(port, () => {
    console.log(`Quiet Current API http://127.0.0.1:${port}`);
    console.log(`  DATA_DIR=${DATA_DIR}`);
    console.log(`  CHAT_MODE=${CHAT_MODE} model=${CHAT_MODE === "ollama" ? OLLAMA_MODEL : OPENAI_MODEL}`);
  });
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : "";
const isDirectRun = resolve(fileURLToPath(import.meta.url)) === entryPath;
if (isDirectRun) {
  startServer();
}
