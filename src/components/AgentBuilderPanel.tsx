import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notifyAgentsUpdated } from "../lib/agentPersonas";

type BehaviorTuning = {
  softnessDirectness: number;
  reflectiveAction: number;
  sparseExpansive: number;
  groundingReframing: number;
};

type ContextSources = {
  notes: boolean;
  gratitudes: boolean;
  reflections: boolean;
  intentions: boolean;
  practices: boolean;
  weeklyReviews: boolean;
  guideChats: boolean;
};

type ContextAccess = {
  enabled: boolean;
  sources: ContextSources;
  recencyWindowDays: number;
};

type BuilderForm = {
  identity: {
    name: string;
    description: string;
    role: string;
    focus: string[];
  };
  voice: {
    tone: string;
    speakingStyle: string;
    encouragementStyle: string;
  };
  boundaries: {
    noMedical: boolean;
    privacy: boolean;
    supportiveOnly: boolean;
  };
  contextAccess: ContextAccess;
  behaviorTuning: BehaviorTuning;
  customInstructions: string;
};

type StoredAgent = {
  id: number;
  name: string;
  description?: string;
  role?: string;
  focus?: string[];
  system_prompt: string;
  short_description?: string;
  role_purpose?: string;
  tone?: string;
  speaking_style?: string;
  encouragement_style?: string;
  focus_areas_json?: string;
  boundaries_json?: string;
  context_access_json?: string;
  behavior_tuning_json?: string;
  custom_instructions?: string;
  is_active?: number;
  created_at: string;
  updated_at: string;
  guide?: {
    name?: string;
    shortDescription?: string;
    description?: string;
    rolePurpose?: string;
    role?: string;
    tone?: string;
    speakingStyle?: string;
    encouragementStyle?: string;
    focusAreas?: string[];
    focus?: string[];
    boundaries?: Record<string, boolean>;
    contextAccess?: ContextAccess;
    behaviorTuning?: BehaviorTuning;
    customInstructions?: string;
    isActive?: boolean;
  };
};

type ChatMsg = { role: "user" | "assistant"; content: string };
type MachineState = "IDLE" | "EDITING" | "VALID" | "SAVING" | "SAVED";

type GuideTemplate = {
  key: string;
  name: string;
  role: string;
  description: string;
  avatar: string;
  focus: string[];
  voice: BuilderForm["voice"];
  behaviorTuning: BehaviorTuning;
};

const GUIDE_ASSET_BASE = "/textures/guide-builder/";
const DEFAULT_CONTEXT_SOURCES: ContextSources = {
  notes: true,
  gratitudes: true,
  reflections: true,
  intentions: true,
  practices: true,
  weeklyReviews: true,
  guideChats: true,
};

const DEFAULT_TUNING: BehaviorTuning = {
  softnessDirectness: 25,
  reflectiveAction: 35,
  sparseExpansive: 35,
  groundingReframing: 30,
};

const GUIDE_TEMPLATES: GuideTemplate[] = [
  {
    key: "gentle-anchor",
    name: "Gentle Anchor",
    role: "Reflective companion",
    description: "A calm, steady presence that helps me return to what matters.",
    avatar: "avatar-sage.svg",
    focus: ["Anxiety", "Overthinking", "Clarity"],
    voice: { tone: "Gentle", speakingStyle: "Short and supportive", encouragementStyle: "Balanced" },
    behaviorTuning: DEFAULT_TUNING,
  },
  {
    key: "clarity-coach",
    name: "Clarity Coach",
    role: "Encouraging mentor",
    description: "A clear voice for sorting thoughts into one grounded next step.",
    avatar: "avatar-amber.svg",
    focus: ["Clarity", "Focus"],
    voice: { tone: "Direct", speakingStyle: "Practical and direct", encouragementStyle: "Accountability-oriented" },
    behaviorTuning: { softnessDirectness: 82, reflectiveAction: 82, sparseExpansive: 22, groundingReframing: 54 },
  },
  {
    key: "evening-unwind",
    name: "Evening Unwind",
    role: "Soothing companion",
    description: "A soft evening guide for closing loops and settling the body.",
    avatar: "avatar-lavender.svg",
    focus: ["Rest", "Overthinking"],
    voice: { tone: "Warm", speakingStyle: "Reflective and spacious", encouragementStyle: "Very gentle" },
    behaviorTuning: { softnessDirectness: 18, reflectiveAction: 20, sparseExpansive: 48, groundingReframing: 22 },
  },
  {
    key: "focus-friend",
    name: "Focus Friend",
    role: "Supportive partner",
    description: "A practical companion for choosing one task and staying kind.",
    avatar: "avatar-sage.svg",
    focus: ["Focus", "Confidence"],
    voice: { tone: "Warm", speakingStyle: "Practical and direct", encouragementStyle: "Balanced" },
    behaviorTuning: { softnessDirectness: 58, reflectiveAction: 76, sparseExpansive: 24, groundingReframing: 44 },
  },
  {
    key: "grounded-guide",
    name: "Grounded Guide",
    role: "Calm companion",
    description: "A steady, body-based guide for stabilizing before solving.",
    avatar: "avatar-blue.svg",
    focus: ["Body", "Grounding", "Presence"],
    voice: { tone: "Gentle", speakingStyle: "Short and supportive", encouragementStyle: "Balanced" },
    behaviorTuning: { softnessDirectness: 22, reflectiveAction: 34, sparseExpansive: 18, groundingReframing: 6 },
  },
];

const FOCUS_AREAS = ["Anxiety", "Overthinking", "Clarity", "Self love", "Focus", "Rest", "Confidence", "Grounding", "Presence"];
const TONES = ["Gentle", "Warm", "Direct", "Playful", "Neutral"];
const SUGGESTIONS = ["I feel anxious", "Help me slow down", "I feel stuck"];
const STEPS = [
  { key: "identity", title: "Identity", summary: "Give your guide a clear presence." },
  { key: "voice", title: "Voice", summary: "How should it speak and feel?" },
  { key: "boundaries", title: "Boundaries", summary: "Where should it stay grounded?" },
  { key: "preview", title: "Preview", summary: "See how it responds before saving." },
];

function defaultForm(template = GUIDE_TEMPLATES[0]): BuilderForm {
  return {
    identity: {
      name: template.name,
      description: template.description,
      role: template.role,
      focus: [...template.focus],
    },
    voice: { ...template.voice },
    boundaries: {
      noMedical: true,
      privacy: true,
      supportiveOnly: true,
    },
    contextAccess: {
      enabled: false,
      sources: { ...DEFAULT_CONTEXT_SOURCES },
      recencyWindowDays: 30,
    },
    behaviorTuning: { ...template.behaviorTuning },
    customInstructions: "",
  };
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T extends object>(value: unknown, fallback: T): T {
  if (value && typeof value === "object" && !Array.isArray(value)) return { ...fallback, ...(value as object) } as T;
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? ({ ...fallback, ...parsed } as T) : fallback;
  } catch {
    return fallback;
  }
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isValidForm(form: BuilderForm) {
  return form.identity.name.trim().length >= 2 && form.identity.description.trim().length >= 8 && form.identity.role.trim().length >= 2;
}

function buildLegacySystemPrompt(form: BuilderForm) {
  const focus = form.identity.focus.length ? form.identity.focus.join(", ") : "current emotional context";
  const contextMode = form.contextAccess.enabled ? "use allowed local app history when relevant" : "use current chat only";
  const custom = form.customInstructions.trim();
  const lines = [
    `You are ${form.identity.name.trim() || "a reflective guide"}, ${form.identity.role.trim() || "reflective companion"}.`,
    `Purpose: ${form.identity.description.trim() || "Offer calm, practical reflective support."}`,
    `Tone: ${form.voice.tone}.`,
    `Speaking style: ${form.voice.speakingStyle}.`,
    `Encouragement style: ${form.voice.encouragementStyle}.`,
    `Focus areas: ${focus}.`,
    `Context mode: ${contextMode}.`,
    "Safety: do not provide medical, crisis, diagnosis, legal, or emergency advice.",
    "If acute distress appears, encourage trusted human or local emergency support.",
    "Keep responses concise, warm, and practical. Ask at most one gentle follow-up question.",
  ];
  if (custom) {
    lines.push("Additional guide instructions:");
    lines.push(custom);
  }
  return lines.join("\n");
}

function formToPayload(form: BuilderForm, isActive = true) {
  const systemPrompt = buildLegacySystemPrompt(form);
  return {
    name: form.identity.name.trim(),
    description: form.identity.description.trim(),
    role: form.identity.role,
    focus: form.identity.focus,
    voice: form.voice,
    shortDescription: form.identity.description.trim(),
    rolePurpose: form.identity.role,
    tone: form.voice.tone,
    speakingStyle: form.voice.speakingStyle,
    encouragementStyle: form.voice.encouragementStyle,
    focusAreas: form.identity.focus,
    boundaries: {
      avoidMedicalOrCrisisAdvice: form.boundaries.noMedical,
      respectUserPrivacy: form.boundaries.privacy,
      staySupportiveLane: form.boundaries.supportiveOnly,
      avoidDiagnosis: true,
      avoidCertaintyClaims: true,
    },
    noMedical: form.boundaries.noMedical,
    privacy: form.boundaries.privacy,
    supportiveOnly: form.boundaries.supportiveOnly,
    contextAccess: form.contextAccess,
    behaviorTuning: form.behaviorTuning,
    customInstructions: form.customInstructions.trim(),
    // Backward-compat for legacy /api/agents and /api/agents/chat handlers.
    systemPrompt,
    isActive,
  };
}

function formFromAgent(agent: StoredAgent): BuilderForm {
  const guide = agent.guide || {};
  const focus = guide.focusAreas || guide.focus || agent.focus || parseJsonArray(agent.focus_areas_json);
  const boundaries = guide.boundaries || parseJsonObject(agent.boundaries_json, {});
  const contextAccess = guide.contextAccess || parseJsonObject<ContextAccess>(agent.context_access_json, {
    enabled: false,
    sources: { ...DEFAULT_CONTEXT_SOURCES },
    recencyWindowDays: 30,
  });
  const behaviorTuning = guide.behaviorTuning || parseJsonObject<BehaviorTuning>(agent.behavior_tuning_json, DEFAULT_TUNING);
  return {
    identity: {
      name: agent.name || guide.name || "New guide",
      description: guide.shortDescription || guide.description || agent.short_description || agent.description || "",
      role: guide.rolePurpose || guide.role || agent.role_purpose || agent.role || "Reflective companion",
      focus: focus.length ? focus : [],
    },
    voice: {
      tone: guide.tone || agent.tone || "Gentle",
      speakingStyle: guide.speakingStyle || agent.speaking_style || "Short and supportive",
      encouragementStyle: guide.encouragementStyle || agent.encouragement_style || "Balanced",
    },
    boundaries: {
      noMedical: boundaries.noMedical ?? boundaries.avoidMedicalOrCrisisAdvice ?? true,
      privacy: boundaries.privacy ?? boundaries.respectUserPrivacy ?? true,
      supportiveOnly: boundaries.supportiveOnly ?? boundaries.staySupportiveLane ?? true,
    },
    contextAccess: {
      enabled: Boolean(contextAccess.enabled),
      sources: { ...DEFAULT_CONTEXT_SOURCES, ...(contextAccess.sources || {}) },
      recencyWindowDays: contextAccess.recencyWindowDays || 30,
    },
    behaviorTuning: {
      softnessDirectness: clamp(behaviorTuning.softnessDirectness ?? DEFAULT_TUNING.softnessDirectness),
      reflectiveAction: clamp(behaviorTuning.reflectiveAction ?? DEFAULT_TUNING.reflectiveAction),
      sparseExpansive: clamp(behaviorTuning.sparseExpansive ?? DEFAULT_TUNING.sparseExpansive),
      groundingReframing: clamp(behaviorTuning.groundingReframing ?? DEFAULT_TUNING.groundingReframing),
    },
    customInstructions: guide.customInstructions || agent.custom_instructions || "",
  };
}

function sliderDescriptor(key: keyof BehaviorTuning, value: number) {
  if (key === "softnessDirectness") {
    if (value < 35) return "Mostly soft, validating, and slow.";
    if (value > 70) return "Clearly direct, concise, and action-oriented.";
    return "Balanced warmth with useful clarity.";
  }
  if (key === "reflectiveAction") {
    if (value < 35) return "Reflective first, with pattern-finding before action.";
    if (value > 70) return "Moves toward the next practical step quickly.";
    return "Reflects briefly, then offers one grounded move.";
  }
  if (key === "sparseExpansive") {
    if (value < 35) return "Sparse, minimal, and easy to scan.";
    if (value > 70) return "More spacious and explanatory when useful.";
    return "Concise, with enough context to feel human.";
  }
  if (value < 35) return "Grounding-led: body, breath, room, and senses.";
  if (value > 70) return "Reframing-led: meaning, intention, and perspective.";
  return "Blends grounding cues with simple reframes.";
}

function templateForName(name: string) {
  return GUIDE_TEMPLATES.find((template) => template.name.toLowerCase() === name.toLowerCase()) || GUIDE_TEMPLATES[0];
}

export function AgentBuilderPanel({ embedded = false }: { embedded?: boolean }) {
  const [agents, setAgents] = useState<StoredAgent[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeGuideKey, setActiveGuideKey] = useState("gentle-anchor");
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState<BuilderForm>(() => defaultForm());
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "Hi friend, I'm here with you. What is on your mind right now?" },
  ]);
  const [input, setInput] = useState("");
  const [lastPreviewPrompt, setLastPreviewPrompt] = useState("");
  const [previewTyping, setPreviewTyping] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [machineState, setMachineState] = useState<MachineState>("IDLE");
  const [err, setErr] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [showContextDetails, setShowContextDetails] = useState(false);
  const [completion, setCompletion] = useState(false);
  const previewRequest = useRef(0);
  const revealTimer = useRef<number | null>(null);
  const debounceTimer = useRef<number | null>(null);
  const messagesRef = useRef<ChatMsg[]>(messages);

  const activeTemplate = useMemo(() => templateForName(form.identity.name), [form.identity.name]);
  const assistantLabel = form.identity.name.trim() || "New guide";
  const progress = ((activeStep + 1) / STEPS.length) * 100;
  const valid = isValidForm(form);
  const guidePayload = useMemo(() => formToPayload(form, true), [form]);

  async function refreshAgents() {
    const r = await fetch("/api/agents");
    if (!r.ok) return;
    const list = (await r.json()) as StoredAgent[];
    if (Array.isArray(list)) setAgents(list);
  }

  useEffect(() => {
    void refreshAgents();
    return () => {
      if (revealTimer.current) window.clearInterval(revealTimer.current);
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const updateForm = useCallback((updater: (current: BuilderForm) => BuilderForm) => {
    setForm((current) => {
      const next = updater(current);
      setCompletion(false);
      setMachineState(isValidForm(next) ? "VALID" : "EDITING");
      return next;
    });
  }, []);

  function resetDraft(blank = false) {
    const next = blank
      ? {
          ...defaultForm(),
          identity: { name: "", description: "", role: "Reflective companion", focus: [] },
        }
      : defaultForm();
    setSelectedId(null);
    setActiveGuideKey("gentle-anchor");
    setForm(next);
    setInput("");
    setLastPreviewPrompt("");
    setMessages([{ role: "assistant", content: "Hi friend, I'm here with you. What is on your mind right now?" }]);
    setActiveStep(0);
    setErr(null);
    setPreviewError(null);
    setCompletion(false);
    setMachineState(blank ? "IDLE" : "VALID");
  }

  function applyTemplate(template: GuideTemplate) {
    setSelectedId(null);
    setActiveGuideKey(template.key);
    setForm(defaultForm(template));
    setActiveStep(0);
    setErr(null);
    setPreviewError(null);
    setCompletion(false);
    setMachineState("VALID");
  }

  function selectAgent(row: StoredAgent) {
    const next = formFromAgent(row);
    const matchedTemplate = templateForName(row.name);
    setActiveGuideKey(matchedTemplate.key);
    setSelectedId(row.id);
    setForm(next);
    setActiveStep(0);
    setErr(null);
    setPreviewError(null);
    setCompletion(false);
    setMachineState(isValidForm(next) ? "VALID" : "EDITING");
  }

  const runPreview = useCallback(
    async (prompt: string, replaceLast = false) => {
      const t = prompt.trim();
      if (!t || !isValidForm(form)) return;
      const requestId = ++previewRequest.current;
      setPreviewTyping(true);
      setPreviewError(null);
      setLastPreviewPrompt(t);
      if (revealTimer.current) window.clearInterval(revealTimer.current);

      const currentMessages = messagesRef.current;
      const lastUserIndex = currentMessages.map((message) => message.role).lastIndexOf("user");
      const baseMessages = replaceLast && lastUserIndex >= 0
        ? currentMessages.slice(0, lastUserIndex + 1).map((message, index) =>
            index === lastUserIndex ? { role: "user" as const, content: t } : message
          )
        : [...currentMessages, { role: "user" as const, content: t }];
      setMessages(baseMessages);

      try {
        const r = await fetch("/api/agents/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...guidePayload, messages: baseMessages.filter((m) => m.role === "user" || m.role === "assistant") }),
        });
        const data = (await r.json().catch(() => ({}))) as { content?: string; error?: string; hint?: string; fallback?: boolean };
        if (!r.ok) throw new Error(data.error || "Preview failed.");
        if (requestId !== previewRequest.current) return;
        const response = String(data.content || "").trim();
        if (!response) throw new Error("Preview returned an empty response.");

        const words = response.split(/\s+/);
        let index = 0;
        setMessages([...baseMessages, { role: "assistant", content: "" }]);
        revealTimer.current = window.setInterval(() => {
          index += 2;
          const partial = words.slice(0, index).join(" ");
          setMessages([...baseMessages, { role: "assistant", content: partial }]);
          if (index >= words.length && revealTimer.current) {
            window.clearInterval(revealTimer.current);
            revealTimer.current = null;
          }
        }, 18);
      } catch (e) {
        if (requestId === previewRequest.current) {
          setPreviewError(e instanceof Error ? e.message : "Preview unavailable.");
        }
      } finally {
        if (requestId === previewRequest.current) setPreviewTyping(false);
      }
    },
    [form, guidePayload]
  );

  useEffect(() => {
    if (!lastPreviewPrompt || !valid) return;
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      void runPreview(lastPreviewPrompt, true);
    }, 750);
  }, [guidePayload, lastPreviewPrompt, runPreview, valid]);

  async function saveGuide(saveAsNew = false) {
    if (!valid) {
      setErr("Give your guide a name, description, and role before saving.");
      setActiveStep(0);
      setMachineState("EDITING");
      return;
    }
    setMachineState("SAVING");
    setErr(null);
    try {
      const targetId = selectedId != null && !saveAsNew ? selectedId : null;
      const r = await fetch(targetId ? `/api/agents/${targetId}` : "/api/agents", {
        method: targetId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(guidePayload),
      });
      const data = (await r.json().catch(() => ({}))) as StoredAgent & { error?: string };
      if (!r.ok) {
        setMachineState("VALID");
        setErr(data.error || "Could not save guide.");
        return;
      }
      if (typeof data.id === "number") setSelectedId(data.id);
      setAgents((current) => {
        const withoutSaved = current.filter((agent) => agent.id !== data.id);
        return [data, ...withoutSaved].map((agent) => ({ ...agent, is_active: agent.id === data.id ? 1 : 0 }));
      });
      setMachineState("SAVED");
      setCompletion(true);
      setActiveStep(3);
      notifyAgentsUpdated();
      void refreshAgents();
    } catch (e) {
      setMachineState("VALID");
      setErr(e instanceof Error ? e.message : "Could not save guide.");
    }
  }

  function toggleFocus(area: string) {
    updateForm((current) => ({
      ...current,
      identity: {
        ...current.identity,
        focus: current.identity.focus.includes(area)
          ? current.identity.focus.filter((item) => item !== area)
          : [...current.identity.focus, area],
      },
    }));
  }

  function moveToStep(index: number) {
    if (index > 0 && !valid) {
      setErr("Complete identity basics before moving forward.");
      setActiveStep(0);
      return;
    }
    setErr(null);
    setCompletion(false);
    setActiveStep(index);
  }

  function nextStep() {
    moveToStep(Math.min(activeStep + 1, STEPS.length - 1));
  }

  function previousStep() {
    setErr(null);
    setCompletion(false);
    setActiveStep((step) => Math.max(step - 1, 0));
  }

  const savedRows = useMemo(() => {
    const agentRows = agents.map((agent) => {
      const template = templateForName(agent.name);
      const guide = agent.guide || {};
      return {
        key: `agent-${agent.id}`,
        id: agent.id,
        name: agent.name,
        role: guide.rolePurpose || guide.role || agent.role_purpose || agent.role || template.role,
        avatar: template.avatar,
        agent,
      };
    });
    const templateRows = GUIDE_TEMPLATES.filter(
      (template) => !agents.some((agent) => agent.name.toLowerCase() === template.name.toLowerCase())
    ).map((template) => ({ ...template, id: null, agent: null }));
    return [...agentRows, ...templateRows];
  }, [agents]);

  const stepContent = [
    <section key="identity" className="gb-step-pane" aria-labelledby="gb-identity-title">
      <h4 id="gb-identity-title">Who is this guide?</h4>
      <p>Give your guide a name and purpose.</p>
      <div className="gb-two-field-grid">
        <label className="agent-builder-field" htmlFor="agent-name">
          <span>Guide name</span>
          <input
            id="agent-name"
            type="text"
            className="agent-input"
            value={form.identity.name}
            onChange={(e) =>
              updateForm((current) => ({
                ...current,
                identity: { ...current.identity, name: e.target.value.slice(0, 60) },
              }))
            }
            placeholder="Gentle Anchor"
            autoComplete="off"
            maxLength={60}
          />
          <span className="gb-counter">{form.identity.name.length} / 60</span>
        </label>
        <label className="agent-builder-field" htmlFor="agent-description">
          <span>Short description</span>
          <textarea
            id="agent-description"
            className="agent-textarea gb-description-input"
            value={form.identity.description}
            onChange={(e) =>
              updateForm((current) => ({
                ...current,
                identity: { ...current.identity, description: e.target.value.slice(0, 200) },
              }))
            }
            placeholder="A calm, steady presence that helps me return to what matters."
            rows={4}
            maxLength={200}
          />
          <span className="gb-counter">{form.identity.description.length} / 200</span>
        </label>
      </div>
      <label className="agent-builder-field" htmlFor="agent-role">
        <span>Role / purpose</span>
        <select
          id="agent-role"
          className="agent-input"
          value={form.identity.role}
          onChange={(e) =>
            updateForm((current) => ({
              ...current,
              identity: { ...current.identity, role: e.target.value },
            }))
          }
        >
          <option>Reflective companion</option>
          <option>Encouraging mentor</option>
          <option>Soothing companion</option>
          <option>Supportive partner</option>
          <option>Calm companion</option>
        </select>
      </label>
      <div className="agent-builder-field">
        <span>Focus areas optional</span>
        <div className="gb-chip-row">
          {FOCUS_AREAS.map((area) => (
            <button
              key={area}
              type="button"
              className={"gb-chip" + (form.identity.focus.includes(area) ? " gb-chip--active" : "")}
              onClick={() => toggleFocus(area)}
              aria-pressed={form.identity.focus.includes(area)}
            >
              {area}
            </button>
          ))}
        </div>
      </div>
    </section>,
    <section key="voice" className="gb-step-pane" aria-labelledby="gb-voice-title">
      <h4 id="gb-voice-title">How should it behave?</h4>
      <p>Tune the guide's conversational rhythm. Sliders affect the real prompt used in preview and chat.</p>
      <div className="agent-builder-field">
        <span>Tone</span>
        <div className="gb-chip-row">
          {TONES.map((toneOption) => (
            <button
              key={toneOption}
              type="button"
              className={"gb-chip gb-tone-chip" + (form.voice.tone === toneOption ? " gb-chip--active" : "")}
              onClick={() =>
                updateForm((current) => ({
                  ...current,
                  voice: { ...current.voice, tone: toneOption },
                }))
              }
              aria-pressed={form.voice.tone === toneOption}
            >
              {toneOption}
            </button>
          ))}
        </div>
      </div>
      <div className="gb-slider-stack">
        {[
          ["softnessDirectness", "Soft", "Direct"],
          ["reflectiveAction", "Reflective", "Action-oriented"],
          ["sparseExpansive", "Sparse", "Expansive"],
          ["groundingReframing", "Grounding", "Reframing"],
        ].map(([key, left, right]) => {
          const tuningKey = key as keyof BehaviorTuning;
          const value = form.behaviorTuning[tuningKey];
          return (
            <label key={key} className="gb-slider-row">
              <span>
                <strong>{left}</strong>
                <strong>{right}</strong>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={value}
                onChange={(e) =>
                  updateForm((current) => ({
                    ...current,
                    behaviorTuning: {
                      ...current.behaviorTuning,
                      [tuningKey]: clamp(Number(e.target.value)),
                    },
                  }))
                }
              />
              <em>{sliderDescriptor(tuningKey, value)}</em>
            </label>
          );
        })}
      </div>
      <div className="gb-form-grid">
        <label className="agent-builder-field" htmlFor="agent-speaking-style">
          <span>Speaking style</span>
          <select
            id="agent-speaking-style"
            className="agent-input"
            value={form.voice.speakingStyle}
            onChange={(e) =>
              updateForm((current) => ({
                ...current,
                voice: { ...current.voice, speakingStyle: e.target.value },
              }))
            }
          >
            <option>Short and supportive</option>
            <option>Reflective and spacious</option>
            <option>Practical and direct</option>
            <option>Warm and conversational</option>
          </select>
        </label>
        <label className="agent-builder-field" htmlFor="agent-encouragement-style">
          <span>Encouragement style</span>
          <select
            id="agent-encouragement-style"
            className="agent-input"
            value={form.voice.encouragementStyle}
            onChange={(e) =>
              updateForm((current) => ({
                ...current,
                voice: { ...current.voice, encouragementStyle: e.target.value },
              }))
            }
          >
            <option>Balanced</option>
            <option>Very gentle</option>
            <option>Accountability-oriented</option>
            <option>Minimal reassurance</option>
          </select>
        </label>
      </div>
    </section>,
    <section key="boundaries" className="gb-step-pane" aria-labelledby="gb-boundaries-title">
      <h4 id="gb-boundaries-title">Where should it stay grounded?</h4>
      <p>Set clear edges and choose whether this guide may use local app history.</p>
      <div className="gb-toggle-stack">
        {[
          ["noMedical", "Avoid medical or crisis advice", "Guide will not provide medical, emergency, or crisis guidance."],
          ["privacy", "Respect user privacy", "No names, people, or sensitive details unless you choose to share them."],
          ["supportiveOnly", "Stay in supportive lane", "Keep responses reflective, grounding, and kind."],
        ].map(([key, title, copy]) => {
          const boundaryKey = key as keyof BuilderForm["boundaries"];
          return (
            <label key={key} className={"gb-toggle-row" + (form.boundaries[boundaryKey] ? " gb-toggle-row--on" : "")}>
              <span>
                <strong>{title}</strong>
                <em>{copy}</em>
              </span>
              <input
                type="checkbox"
                checked={form.boundaries[boundaryKey]}
                onChange={(e) =>
                  updateForm((current) => ({
                    ...current,
                    boundaries: { ...current.boundaries, [boundaryKey]: e.target.checked },
                  }))
                }
              />
            </label>
          );
        })}
      </div>
      <div className={"gb-context-card" + (form.contextAccess.enabled ? " gb-context-card--on" : "")}>
        <label className="gb-toggle-row gb-toggle-row--context">
          <span>
            <strong>Personalize with my app history</strong>
            <em>When enabled, this guide can reference permitted local notes, reflections, practices, intentions, and weekly reviews.</em>
          </span>
          <input
            type="checkbox"
            checked={form.contextAccess.enabled}
            onChange={(e) =>
              updateForm((current) => ({
                ...current,
                contextAccess: { ...current.contextAccess, enabled: e.target.checked },
              }))
            }
          />
        </label>
        <button type="button" className="gb-context-details-button" onClick={() => setShowContextDetails((value) => !value)}>
          {showContextDetails ? "Hide included sources" : "Show included sources"}
        </button>
        {showContextDetails ? (
          <div className="gb-context-details">
            {Object.entries({
              notes: "Notes",
              gratitudes: "Gratitudes",
              reflections: "Reflections",
              intentions: "Intentions",
              practices: "Practices",
              weeklyReviews: "Weekly reviews",
              guideChats: "Guide chats",
            }).map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={form.contextAccess.sources[key as keyof ContextSources]}
                  disabled={!form.contextAccess.enabled}
                  onChange={(e) =>
                    updateForm((current) => ({
                      ...current,
                      contextAccess: {
                        ...current.contextAccess,
                        sources: { ...current.contextAccess.sources, [key]: e.target.checked },
                      },
                    }))
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        ) : null}
        <p>Your guide only uses local app history you allow.</p>
      </div>
    </section>,
    <section key="preview" className="gb-step-pane" aria-labelledby="gb-review-title">
      <h4 id="gb-review-title">Review before saving</h4>
      <p>Preview the live model behavior, then save the guide locally.</p>
      {completion ? (
        <div className="gb-completion-card" role="status">
          <span aria-hidden="true" className="gb-completion-check" />
          <h4>Guide saved locally</h4>
          <p>{assistantLabel} is active and ready to support you.</p>
          <div className="agent-form-actions">
            <a className="btn btn-primary" href="?tab=chat">
              Start using this guide
            </a>
            <button type="button" className="btn" onClick={() => setCompletion(false)}>
              Back to my guides
            </button>
          </div>
        </div>
      ) : (
        <>
          {machineState === "SAVED" ? <p className="gb-success-banner">Saved locally</p> : null}
          <div className="gb-review-summary">
            <div>
              <span>Name</span>
              <strong>{assistantLabel}</strong>
            </div>
            <div>
              <span>Voice</span>
              <strong>{form.voice.tone} - {form.voice.speakingStyle}</strong>
            </div>
            <div>
              <span>Behavior</span>
              <strong>{sliderDescriptor("softnessDirectness", form.behaviorTuning.softnessDirectness)}</strong>
            </div>
            <div>
              <span>Context</span>
              <strong>{form.contextAccess.enabled ? "Using app history" : "Current chat only"}</strong>
            </div>
          </div>
          {err && <p className="err">{err}</p>}
        </>
      )}
    </section>,
  ];

  return (
    <div className={embedded ? "agent-builder-universe agent-builder-universe--embedded" : "agent-builder-universe"}>
      {!embedded ? <div className="agent-builder-glow" aria-hidden="true" /> : null}
      <div className={(embedded ? "" : "panel ") + "agent-builder-panel agent-builder-redesign agent-builder-stepflow"}>
        <div className="gb-top-actions">
          <button type="button" className="gb-discard-button" onClick={() => setConfirmDiscard(true)}>
            Discard draft
          </button>
          <button type="button" className="gb-new-guide gb-new-guide--primary" onClick={() => resetDraft(true)}>
            <span aria-hidden="true">+</span> New guide
          </button>
        </div>

        <div className="agent-builder-stage">
          <section className="gb-create-card" aria-labelledby="gb-create-title">
            <nav className="gb-vertical-stepper" aria-label="Guide builder steps">
              {STEPS.map((step, index) => {
                const complete = index < activeStep || machineState === "SAVED";
                return (
                  <button
                    key={step.key}
                    type="button"
                    className={
                      "gb-step-nav" +
                      (index === activeStep ? " gb-step-nav--active" : "") +
                      (complete ? " gb-step-nav--complete" : "")
                    }
                    onClick={() => moveToStep(index)}
                    aria-current={index === activeStep ? "step" : undefined}
                  >
                    <b>{index + 1}</b>
                    <span>
                      <strong>{step.title}</strong>
                      <em>{step.summary}</em>
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="gb-step-workspace">
              <div className="guide-builder-safety-note gb-inline-safety" role="note">
                <span aria-hidden="true" />
                <p>Prompts are capped on the server; safety rules always apply first. Not medical or crisis advice-reach out to trusted humans when you need hands-on help.</p>
              </div>

              <div className="gb-step-card">
                <div className="gb-step-meta">
                  <span>Step {activeStep + 1} of 4 - {STEPS[activeStep].title}</span>
                  <div className="gb-progress" aria-hidden="true">
                    <i style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <div className="gb-step-transition" key={activeStep + String(completion)}>
                  {stepContent[activeStep]}
                </div>
                {!completion ? (
                  <div className="gb-step-actions">
                    <button type="button" className="btn" onClick={previousStep} disabled={activeStep === 0 || machineState === "SAVING"}>
                      Back
                    </button>
                    {activeStep < STEPS.length - 1 ? (
                      <button type="button" className="btn btn-primary" onClick={nextStep}>
                        Next
                      </button>
                    ) : (
                      <>
                        <button type="button" className="btn" disabled={!valid || machineState === "SAVING"} onClick={() => void saveGuide(true)}>
                          Save as new draft
                        </button>
                        <button type="button" className="btn btn-primary" disabled={!valid || machineState === "SAVING"} onClick={() => void saveGuide(false)}>
                          {machineState === "SAVING" ? "Saving..." : "Save guide"}
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <aside className="gb-preview-rail" aria-label="Guide preview and saved guides">
            <section className="gb-preview-card" id="gb-live-preview">
              <div className="gb-preview-card-head">
                <div>
                  <h3>Preview</h3>
                  <p>See how your guide will respond.</p>
                </div>
                <span className="gb-context-indicator">{form.contextAccess.enabled ? "Using app history" : "Current chat only"}</span>
              </div>
              <div className="gb-chat-preview">
                <div className="gb-preview-identity">
                  <img src={GUIDE_ASSET_BASE + activeTemplate.avatar} alt="" />
                  <div>
                    <h4>{assistantLabel}</h4>
                    <span>{form.identity.role}</span>
                  </div>
                </div>
                <div className="gb-preview-messages" role="log" aria-live="polite">
                  {messages.map((m, i) => (
                    <div key={i} className={"gb-preview-msg gb-preview-msg--" + m.role}>
                      {m.content}
                    </div>
                  ))}
                  {previewTyping && (
                    <div className="gb-preview-msg gb-preview-msg--assistant gb-typing" aria-busy="true">
                      <span>Guide is typing</span>
                      <i />
                      <i />
                      <i />
                    </div>
                  )}
                </div>
                {previewError ? <p className="gb-preview-error">{previewError}</p> : null}
                <div className="gb-suggestion-row">
                  {SUGGESTIONS.map((suggestion) => (
                    <button key={suggestion} type="button" onClick={() => void runPreview(suggestion)}>
                      {suggestion}
                    </button>
                  ))}
                </div>
                <div className="gb-preview-compose">
                  <label htmlFor="agent-chat-input" className="sr-only">
                    Message
                  </label>
                  <input
                    id="agent-chat-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void runPreview(input);
                        setInput("");
                      }
                    }}
                    placeholder="Type a message..."
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void runPreview(input);
                      setInput("");
                    }}
                    disabled={!input.trim() || !valid || previewTyping}
                    aria-label="Send"
                  >
                    Send
                  </button>
                </div>
              </div>
            </section>

            <section className="gb-saved-card">
              <div className="gb-saved-head">
                <div>
                  <h3>Your guides</h3>
                  <p>Manage your saved guides.</p>
                </div>
                <button type="button" className="gb-new-guide" onClick={() => resetDraft(true)}>
                  + New guide
                </button>
              </div>
              <div className="gb-guide-list">
                {savedRows.map((row) => {
                  const active = (row.agent && row.agent.id === selectedId) || (!row.agent && row.key === activeGuideKey);
                  return (
                    <button
                      key={row.key}
                      type="button"
                      className={"gb-guide-row" + (active ? " gb-guide-row--active" : "")}
                      onClick={() => (row.agent ? selectAgent(row.agent) : applyTemplate(row as GuideTemplate))}
                    >
                      <img src={GUIDE_ASSET_BASE + row.avatar} alt="" />
                      <span>
                        <strong>{row.name}</strong>
                        <em>{row.role}</em>
                      </span>
                      {active ? <b>Active</b> : <em aria-hidden="true" className="gb-row-menu">...</em>}
                    </button>
                  );
                })}
              </div>
              <p className="gb-lock-line">Guides are saved locally on your device.</p>
            </section>
          </aside>
        </div>
      </div>

      {confirmDiscard ? (
        <div className="gb-modal-backdrop" role="presentation">
          <div className="gb-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="gb-discard-title">
            <h3 id="gb-discard-title">Discard draft?</h3>
            <p>This clears the current guide fields and returns you to the first step.</p>
            <div className="agent-form-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  resetDraft(true);
                  setConfirmDiscard(false);
                }}
              >
                Discard draft
              </button>
              <button type="button" className="btn" onClick={() => setConfirmDiscard(false)}>
                Keep editing
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
