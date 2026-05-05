import { useState } from "react";
import { notifyAgentsUpdated } from "../lib/agentPersonas";
import { formatApiErrorMessage, readApiJson } from "../lib/readApiJson";

type TeacherGuidance = {
  teacher: string;
  why: string;
  guidance: string;
  mantra: string;
  teacherListSize?: number;
  fallback?: boolean;
  reason?: string;
};

type BuildAgentResponse = {
  agent: { id: number; name: string; system_prompt: string; created_at: string; updated_at: string };
  figure: string;
  whyFit: string;
  fallback?: boolean;
  reason?: string;
};

export function TeacherGuidancePanel({ embedded = false }: { embedded?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [data, setData] = useState<TeacherGuidance | null>(null);

  const [situation, setSituation] = useState("");
  const [fromNotes, setFromNotes] = useState(false);
  const [buildLoading, setBuildLoading] = useState(false);
  const [buildErr, setBuildErr] = useState<string | null>(null);
  const [buildHint, setBuildHint] = useState<string | null>(null);
  const [buildResult, setBuildResult] = useState<BuildAgentResponse | null>(null);

  async function onGenerate() {
    setLoading(true);
    setErr(null);
    setHint(null);
    try {
      const r = await fetch("/api/teachers/recommend", { method: "POST" });
      const { ok, json: j } = await readApiJson<TeacherGuidance>(r);
      if (!ok) {
        setErr(formatApiErrorMessage(j, "Could not generate teacher guidance."));
        return;
      }
      setData(j);
      if (j.fallback) {
        setHint(
          j.reason === "model_response_parse_failed"
            ? "AI responded, but format was messy; using a local pattern-based suggestion."
            : "AI unavailable; using a local pattern-based suggestion."
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not generate teacher guidance.");
    } finally {
      setLoading(false);
    }
  }

  async function onBuildAgent() {
    const sit = situation.trim();
    if (!sit && !fromNotes) {
      setBuildErr("Describe your situation and/or check “Build from my journal.”");
      return;
    }
    setBuildLoading(true);
    setBuildErr(null);
    setBuildHint(null);
    setBuildResult(null);
    try {
      const r = await fetch("/api/teachers/build-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ situation: sit, fromNotes }),
      });
      const { ok, json: j } = await readApiJson<BuildAgentResponse & { error?: string; hint?: string }>(r);
      if (!ok) {
        setBuildErr(formatApiErrorMessage(j, "Could not build guide agent."));
        return;
      }
      setBuildResult(j);
      if (j.fallback) {
        setBuildHint(
          j.reason === "model_parse_or_validation_failed"
            ? "Model output was adjusted; saved a safe default guide matching your themes."
            : "AI unavailable; saved a local-matched guide you can still use in Guide."
        );
      } else {
        setBuildHint("Guide saved. Pick it in Guide, or refine it under Agent builder.");
      }
      notifyAgentsUpdated();
    } catch (e) {
      setBuildErr(e instanceof Error ? e.message : "Could not build guide agent.");
    } finally {
      setBuildLoading(false);
    }
  }

  return (
    <div className={(embedded ? "" : "panel ") + "teacher-panel"}>
      <h2>Teachers</h2>
      <p className="subtitle">
        The model suggests a guide voice suited to your situation—philosophy, psychology, contemplative teachers,
        reflective writers, or other public wisdom voices. Get one-off guidance, or <em>save a tailored Guide agent</em>{" "}
        for the chat tab.
      </p>

      <section className="teacher-section" aria-labelledby="teacher-once-title">
        <h3 id="teacher-once-title" className="teacher-section-title">
          One-time guidance
        </h3>
        <p className="teacher-section-lead">
          We read your recent journal and chat tone (local only) and suggest one resonant voice plus a short reading.
        </p>
        <div className="weekly-toolbar">
          <button type="button" className="btn btn-primary" onClick={() => void onGenerate()} disabled={loading}>
            {loading ? "Listening…" : "Suggest a guide for me"}
          </button>
        </div>
        {hint && <p className="hint">{hint}</p>}
        {err && <p className="err">{err}</p>}
        {data ? (
          <section className="teacher-result" aria-label="Teacher recommendation">
            <h4>{data.teacher}</h4>
            <p className="home-card-hint">{data.why}</p>
            <pre className="weekly-output">{data.guidance}</pre>
            {data.mantra ? (
              <p className="teacher-mantra">
                <strong>Mantra:</strong> {data.mantra}
              </p>
            ) : null}
          </section>
        ) : null}
      </section>

      <section className="teacher-section teacher-section--build" aria-labelledby="teacher-build-title">
        <h3 id="teacher-build-title" className="teacher-section-title">
          Build a Guide agent
        </h3>
        <p className="teacher-section-lead">
          Describe what you are navigating, optionally pull in recent journal lines, and we will suggest an
          appropriate guide voice and write a <em>system prompt</em> you can chat with in <em>Guide</em> (persona menu).
        </p>
        <label htmlFor="teacher-situation" className="teacher-label">
          Your situation
        </label>
        <textarea
          id="teacher-situation"
          className="teacher-situation-input"
          rows={4}
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
          placeholder="What is alive for you right now—work, love, anxiety, a decision, grief, habits…"
        />
        <label className="teacher-checkbox">
          <input type="checkbox" checked={fromNotes} onChange={(e) => setFromNotes(e.target.checked)} />
          <span>Build from my journal (uses recent note excerpts; local only)</span>
        </label>
        <div className="weekly-toolbar">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void onBuildAgent()}
            disabled={buildLoading || (!situation.trim() && !fromNotes)}
          >
            {buildLoading ? "Building…" : "Create Guide agent"}
          </button>
        </div>
        {buildHint && <p className="hint">{buildHint}</p>}
        {buildErr && <p className="err">{buildErr}</p>}
        {buildResult ? (
          <div className="teacher-build-result" role="status">
            <p className="teacher-build-figure">
              <span className="teacher-build-k">Voice:</span> {buildResult.figure}
            </p>
            <p className="home-card-hint">{buildResult.whyFit}</p>
            <p className="teacher-build-saved">
              Saved as <span className="teacher-build-name">{buildResult.agent.name}</span> (id {buildResult.agent.id}).
            </p>
            <p className="teacher-build-next">
              Next: open <em>Guide</em>, choose this guide in the persona menu, or edit the prompt under{" "}
              <em>Guide builder → Agent builder</em>.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
