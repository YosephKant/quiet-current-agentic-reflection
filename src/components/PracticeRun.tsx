import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Practice } from "../types";

const COMPLETION_STORAGE_KEY = "quiet-current.practice-completions.v1";

type PracticeMood = "calm" | "neutral" | "restless";

type PracticeCompletion = {
  id: string;
  practiceId: number;
  title: string;
  category: string;
  minutes: number;
  mood: PracticeMood;
  reflection: string;
  completedAt: string;
};

function playGong() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(220, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 1.4);
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.22, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2.8);
    o.start();
    o.stop(ctx.currentTime + 2.8);
  } catch {
    // Audio is a nice-to-have; ignore browsers that block it.
  }
}

function splitSummary(summary: string) {
  const s = String(summary).trim();
  if (!s) return [];
  return s
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function guidanceFrom(practice: Practice, lines: string[]) {
  if (lines.length >= 3) return lines.slice(0, 5);
  const category = practice.category.replace(/_/g, " ");
  return [
    `Arrive without needing this ${category} practice to prove anything.`,
    lines[0] || "Feel the body breathing before you ask the mind to change.",
    "When attention leaves, return as gently as placing a cup back on a table.",
    "Let the final breaths be ordinary. Nothing needs to be completed perfectly.",
  ];
}

function saveCompletion(entry: PracticeCompletion) {
  try {
    const existing = JSON.parse(localStorage.getItem(COMPLETION_STORAGE_KEY) || "[]") as PracticeCompletion[];
    localStorage.setItem(COMPLETION_STORAGE_KEY, JSON.stringify([entry, ...existing].slice(0, 250)));
    window.dispatchEvent(new CustomEvent("quiet-current:practice-completed", { detail: entry }));
  } catch {
    // Local logging is optional; never block the completion flow.
  }
}

export function PracticeRun({ practice, onClose }: { practice: Practice; onClose: () => void }) {
  const defaultMinutes = practice.est_minutes && practice.est_minutes > 0 ? Math.min(10, practice.est_minutes) : 2;
  const [phase, setPhase] = useState<"prepare" | "run" | "done">("prepare");
  const [durMin, setDurMin] = useState(defaultMinutes);
  const [remaining, setRemaining] = useState(defaultMinutes * 60);
  const [running, setRunning] = useState(true);
  const [cueIdx, setCueIdx] = useState(0);
  const [mood, setMood] = useState<PracticeMood>("neutral");
  const [reflection, setReflection] = useState("");
  const [saved, setSaved] = useState(false);
  const doneRef = useRef(false);
  const initialFocusRef = useRef<HTMLButtonElement | null>(null);
  const rawLines = useMemo(() => splitSummary(practice.summary), [practice.summary]);
  const cues = useMemo(() => guidanceFrom(practice, rawLines), [practice, rawLines]);
  const elapsed = Math.max(0, durMin * 60 - remaining);
  const progress = durMin > 0 ? Math.min(1, elapsed / (durMin * 60)) : 0;

  useEffect(() => {
    if (phase !== "run" || !running) return;
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (!doneRef.current) {
            doneRef.current = true;
            playGong();
            setPhase("done");
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, running]);

  useEffect(() => {
    if (phase !== "run" || cues.length <= 1) return;
    const cueEvery = Math.max(24, Math.floor((durMin * 60) / cues.length));
    setCueIdx(Math.min(cues.length - 1, Math.floor(elapsed / cueEvery)));
  }, [phase, elapsed, durMin, cues.length]);

  useEffect(() => {
    doneRef.current = false;
    setSaved(false);
    setReflection("");
    setMood("neutral");
    setCueIdx(0);
  }, [practice.id]);

  useEffect(() => {
    const t = window.setTimeout(() => initialFocusRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [practice.id, phase]);

  function begin(minutes: number) {
    const safeMinutes = Math.max(1, Math.min(10, minutes));
    doneRef.current = false;
    setDurMin(safeMinutes);
    setRemaining(safeMinutes * 60);
    setRunning(true);
    setCueIdx(0);
    setPhase("run");
  }

  const endPractice = useCallback(() => {
    if (!doneRef.current) {
      doneRef.current = true;
      playGong();
    }
    setRemaining(0);
    setPhase("done");
  }, []);

  useEffect(() => {
    if (phase === "done") return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (phase === "prepare") onClose();
      else endPractice();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, onClose, endPractice]);

  function saveAndClose() {
    if (!saved) {
      saveCompletion({
        id: `${Date.now()}-${practice.id}`,
        practiceId: practice.id,
        title: practice.title,
        category: practice.category,
        minutes: durMin,
        mood,
        reflection: reflection.trim(),
        completedAt: new Date().toISOString(),
      });
      setSaved(true);
    }
    onClose();
  }

  const prepareOverlay = (
      <div className="practice-run-overlay practice-run-overlay--immersive" role="dialog" aria-modal="true" aria-labelledby="prun-title">
        <div className="practice-player-shell practice-player-shell--prepare">
          <button ref={initialFocusRef} type="button" className="practice-player-close" onClick={onClose} aria-label="Close practice">
            x
          </button>
          <p className="practice-player-kicker">Short practice - {practice.category.replace(/_/g, " ")}</p>
          <h2 id="prun-title">{practice.title}</h2>
          <p className="practice-player-summary">{practice.summary}</p>

          <div className="practice-duration-row" aria-label="Choose duration">
            {[2, 5, 10].map((m) => (
              <button
                key={m}
                type="button"
                className={"duration-chip" + (durMin === m ? " duration-chip--active" : "")}
                onClick={() => setDurMin(m)}
              >
                {m} min
              </button>
            ))}
          </div>

          <div className="practice-player-preview-card">
            <span className="practice-player-preview-dot" />
            <p>{cues[0]}</p>
          </div>

          <div className="practice-run-actions practice-run-actions--center">
            <button type="button" className="btn btn-primary practice-start-large" onClick={() => begin(durMin)}>
              Start {durMin} minute reset
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Not now
            </button>
          </div>
        </div>
      </div>
  );

  const runOverlay = (
      <div className="practice-run-overlay practice-run-overlay--immersive" role="dialog" aria-modal="true" aria-label="Practice player">
        <div className="practice-player-shell practice-player-shell--run">
          <button ref={initialFocusRef} type="button" className="practice-player-close" onClick={endPractice} aria-label="End practice">
            x
          </button>
          <p className="practice-player-kicker">In practice</p>
          <h2>{practice.title}</h2>
          <p className="practice-run-clock" aria-live="polite">
            {formatTime(remaining)}
          </p>

          <div className="breathing-orb-wrap" aria-hidden="true">
            <div className={"breathing-orb" + (running ? " breathing-orb--active" : "")}>
              <div className="breathing-orb-core" />
            </div>
            <div className="breathing-progress" style={{ transform: `scaleX(${Math.max(0.03, progress)})` }} />
          </div>

          <p className="practice-run-cue practice-run-cue--center">{cues[cueIdx] || cues[0]}</p>

          <div className="practice-run-actions practice-run-actions--center">
            <button type="button" className="btn btn-primary" onClick={() => setRunning((v) => !v)}>
              {running ? "Pause" : "Resume"}
            </button>
            <button type="button" className="btn" onClick={endPractice}>
              End
            </button>
          </div>
        </div>
      </div>
  );

  const doneOverlay = (
    <div className="practice-run-overlay practice-run-overlay--immersive" role="dialog" aria-modal="true" aria-label="Practice complete">
      <div className="practice-player-shell practice-player-shell--done">
        <p className="practice-complete-mark">Done</p>
        <h2>Nice. You showed up.</h2>
        <p className="practice-player-summary">One short practice counts. Capture one signal so Insights has something real to work with later.</p>

        <div className="practice-completion-moods" aria-label="How do you feel?">
          {([
            ["calm", "Calm"],
            ["neutral", "Neutral"],
            ["restless", "Restless"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={"mood-chip" + (mood === value ? " mood-chip--active" : "")}
              onClick={() => setMood(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="practice-reflection-label" htmlFor="practice-reflection">
          Optional one-line reflection
        </label>
        <textarea
          id="practice-reflection"
          className="qc-input qc-textarea-like practice-reflection-input"
          rows={3}
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="e.g. my belly softened when I stopped trying to fix it"
          maxLength={600}
        />

        <div className="practice-run-actions practice-run-actions--center">
          <button ref={initialFocusRef} type="button" className="btn btn-primary practice-start-large" onClick={saveAndClose}>
            Save reflection
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Close without saving
          </button>
        </div>
      </div>
    </div>
  );

  const layer = phase === "prepare" ? prepareOverlay : phase === "run" ? runOverlay : doneOverlay;
  return createPortal(layer, document.body);
}
