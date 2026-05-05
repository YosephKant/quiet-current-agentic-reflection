import { useCallback, useEffect, useState } from "react";
import { formatApiErrorMessage, readApiJson } from "../lib/readApiJson";
import {
  startMoodAmbience,
  stopHoroscopeAmbience,
  touchAmbientAudioFromUserGesture,
  type MoodAmbienceSpec,
} from "../lib/horoscopeAmbience";
import { PageHeader } from "./ui/PageHeader";
import "./AmbiencePanel.css";

type GenerateResponse = {
  spec: MoodAmbienceSpec;
  fallback?: boolean;
};

export function AmbiencePanel() {
  const [mood, setMood] = useState("");
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [spec, setSpec] = useState<MoodAmbienceSpec | null>(null);
  const [fromTemplate, setFromTemplate] = useState(false);

  useEffect(() => {
    return () => {
      stopHoroscopeAmbience();
    };
  }, []);

  const onGenerate = useCallback(async () => {
    const q = mood.trim();
    if (!q) {
      setErr("Describe a mood or atmosphere in a few words first.");
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      const r = await fetch("/api/ambience/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mood: q }),
      });
      const { ok, json } = await readApiJson<GenerateResponse & { error?: string }>(r);
      if (!ok || !json?.spec) {
        setSpec(null);
        setErr(formatApiErrorMessage(json, "Could not generate ambience."));
        return;
      }
      setSpec(json.spec);
      setFromTemplate(!!json.fallback);
    } catch (e) {
      setSpec(null);
      setErr(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }, [mood]);

  const onPlay = useCallback(() => {
    if (!spec) return;
    setErr(null);
    touchAmbientAudioFromUserGesture();
    void startMoodAmbience(spec)
      .then(() => setPlaying(true))
      .catch(() => {
        setPlaying(false);
        setErr("Could not start audio. Try tapping Play again after clicking anywhere on the page.");
      });
  }, [spec]);

  const onStop = useCallback(() => {
    stopHoroscopeAmbience();
    setPlaying(false);
  }, []);

  return (
    <div className="panel amb-panel">
      <PageHeader
        title="Ambience"
        subtitle={
          <>
            Describe how you feel or the atmosphere you want. A local model suggests layered tones; your browser
            synthesizes them here—nothing is uploaded as audio files.
          </>
        }
      />

      <p className="amb-panel__intro">
        This is a simple <strong>sine / triangle</strong> stack through one gentle filter—more “color field” than
        music. Use low volume; pause anytime.
      </p>

      <div className="amb-field">
        <label htmlFor="amb-mood-input">Mood or scene</label>
        <textarea
          id="amb-mood-input"
          value={mood}
          onChange={(e) => setMood(e.target.value)}
          placeholder="e.g. rainy window, post-work exhale, soft focus before sleep…"
          maxLength={480}
          rows={4}
        />
      </div>

      <div className="amb-actions">
        <button type="button" className="amb-btn amb-btn--primary" disabled={loading} onClick={() => void onGenerate()}>
          {loading ? "Designing…" : "Generate ambience"}
        </button>
        <button type="button" className="amb-btn amb-btn--ghost" disabled={!spec || loading} onClick={onPlay}>
          Play
        </button>
        <button type="button" className="amb-btn amb-btn--ghost" disabled={!playing} onClick={onStop}>
          Stop
        </button>
        {spec ? (
          <span className={"amb-chip" + (fromTemplate ? "" : " amb-chip--ai")}>
            {fromTemplate ? "Template patch (model unavailable)" : "Model-designed patch"}
          </span>
        ) : null}
      </div>

      {err ? <p className="amb-err">{err}</p> : null}

      {spec ? (
        <section className="amb-card" aria-labelledby="amb-spec-title">
          <h3 id="amb-spec-title">{spec.title}</h3>
          <p className="amb-card__desc">{spec.description}</p>
          <ul className="amb-layers">
            {spec.layers.map((L, i) => (
              <li key={`${L.frequencyHz}-${i}`}>
                Layer {i + 1}: {L.waveform} · {L.frequencyHz.toFixed(1)} Hz · detune {L.detuneCents.toFixed(0)}¢ · gain{" "}
                {L.gain.toFixed(3)}
              </li>
            ))}
          </ul>
          <p className="amb-card__desc" style={{ marginTop: "0.75rem", marginBottom: 0, fontSize: "0.82rem" }}>
            Filter ~{Math.round(spec.lowpassHz)} Hz · swell {spec.swellSeconds.toFixed(1)}s
            {spec.filterSweepToHz != null ? ` · sweep toward ~${Math.round(spec.filterSweepToHz)} Hz` : null}
          </p>
        </section>
      ) : null}

      <p className="amb-footnote">
        Requires your chat model (Ollama or OpenAI-compatible) to be configured like the rest of the app. If the
        model is offline, you still get a <strong>keyword-aware template</strong> so the sliders in the sky stay usable.
      </p>
    </div>
  );
}
