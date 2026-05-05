import { useEffect, useState } from "react";
import { PageHeader } from "./ui/PageHeader";

type ChatConfig = { mode: string; model: string; ollamaUrl: string };

export function DailyHabitsPanel() {
  const [config, setConfig] = useState<ChatConfig | null>(null);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/chat/config");
      if (r.ok) setConfig((await r.json()) as ChatConfig);
    })();
  }, []);

  async function generate() {
    setErr(null);
    setHint(null);
    setLoading(true);
    try {
      const r = await fetch("/api/daily-habits/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ includeNotes, notesLimit: 6 }),
      });
      const data = (await r.json().catch(() => ({}))) as {
        content?: string;
        error?: string;
        detail?: string;
        hint?: string;
      };
      if (!r.ok) {
        setErr(data.error || "Could not generate suggestions.");
        if (data.detail) setErr((e) => (e + " — " + String(data.detail)).slice(0, 500));
        if (data.hint) setHint(data.hint);
        setContent(null);
        return;
      }
      setContent(String(data.content || "").trim() || null);
      if (!String(data.content || "").trim()) {
        setErr("The model returned an empty response. Try again.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed.");
      setHint("Check that the API is running (npm run dev).");
      setContent(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel habits-panel">
      <PageHeader
        title="Daily rhythm"
        subtitle={
          <>
            A fresh set of gentle, <strong>Abraham Hicks–style</strong> intentions for today—relief, alignment, and
            small steps that feel better. Optional: we read your <strong>recent notes</strong> locally to tailor tone
            (never sent to a third party beyond your chosen model).
          </>
        }
      />

      {config && (
        <p className="config-line">
          Model: <strong>{config.mode}</strong> · {config.model}
        </p>
      )}

      <div className="habits-toolbar">
        <label className="habits-check">
          <input
            type="checkbox"
            checked={includeNotes}
            onChange={(e) => setIncludeNotes(e.target.checked)}
          />
          Use recent notes as soft context
        </label>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void generate()}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? "Generating…" : "Generate new"}
        </button>
      </div>

      {hint && <p className="hint">{hint}</p>}
      {err && <p className="err">{err}</p>}

      {content && (
        <section className="habits-output" aria-label="Generated suggestions">
          <h3 className="habits-output-title">For today</h3>
          <div className="habits-output-body">{content}</div>
        </section>
      )}

      {!content && !loading && !err && (
        <p className="empty-state habits-empty">
          Press <strong>Generate new</strong> when you want a new pass—each run is independent.
        </p>
      )}

      <p className="muted habits-disclaimer">
        Not medical or therapeutic advice. If you are in crisis, contact local emergency or mental health services.
      </p>
    </div>
  );
}
