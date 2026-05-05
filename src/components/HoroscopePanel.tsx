import { useEffect, useRef, useState } from "react";
import { formatApiErrorMessage, readApiJson } from "../lib/readApiJson";
import {
  startHoroscopeAmbience,
  stopHoroscopeAmbience,
  touchHoroscopeAmbienceFromUserGesture,
} from "../lib/horoscopeAmbience";
import { PageHeader } from "./ui/PageHeader";
import "./horoscope/HoroscopeTab.css";

type HoroscopeResponse = {
  sunSign: string;
  moonSignApprox: string;
  moonPhase: string;
  moonIlluminationPercent: number;
  love: string[];
  career: string[];
  personal: string[];
  closing: string;
  disclaimerHint: string;
  fallback?: boolean;
};

function IconSparkles({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

function IconMoon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M18.5 15.5A8.5 8.5 0 0 1 8.5 5a6.8 6.8 0 1 0 10 10.5Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSun({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="16" rx="2" stroke="currentColor" strokeWidth="1.25" />
      <path d="M8 3v4M16 3v4M3.5 10.5h17" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function IconHeart({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20s-7-4.35-9-9c-1.2-3.2.5-6 3.5-6 1.8 0 3.2 1 4 2.4.8-1.4 2.2-2.4 4-2.4 3 0 4.7 2.8 3.5 6-2 4.65-9 9-9 9Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBriefcase({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="8" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.25" />
      <path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.25" />
      <path d="M4 13h16" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function IconGrowth({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 22V12M12 12c-2-4-6-5-8-2 2-2 5-1 8 2M12 12c2-4 6-5 8-2-2-2-5-1-8 2"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconWave({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HoroscopePanel() {
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [reading, setReading] = useState<HoroscopeResponse | null>(null);
  const [ambientOn, setAmbientOn] = useState(false);
  const birthFormRef = useRef<HTMLDivElement>(null);

  /** Stop when toggled off or on unmount. Do not start audio here — `AudioContext.resume()` must run from the click path. */
  useEffect(() => {
    if (!ambientOn) {
      stopHoroscopeAmbience();
    }
  }, [ambientOn]);

  useEffect(() => () => stopHoroscopeAmbience(), []);

  async function onGetReading() {
    setErr(null);
    setHint(null);
    setLoading(true);
    try {
      const r = await fetch("/api/horoscope/daily", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          birthDate: birthDate.trim(),
          birthTime: birthTime.trim() || undefined,
          birthPlace: birthPlace.trim() || undefined,
        }),
      });
      const { ok, json } = await readApiJson<HoroscopeResponse & { error?: string; hint?: string }>(r);
      if (!ok) {
        setReading(null);
        setErr(formatApiErrorMessage(json, "Could not load reading."));
        return;
      }
      setReading(json as HoroscopeResponse);
      if (json.fallback) {
        setHint("Guide model unavailable; showing a gentle templated reading using today’s sky math.");
      }
    } catch (e) {
      setReading(null);
      setErr(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  function scrollToBirthForm() {
    birthFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const first = birthFormRef.current?.querySelector<HTMLInputElement>("input");
    window.setTimeout(() => first?.focus(), 400);
  }

  return (
    <div className="panel horoscope-panel qc-horoscope-flow hz-tab">
      <div className="hz-tab__stars" aria-hidden />
      <div className="hz-tab__inner">
        <PageHeader
          title="Horoscope"
          subtitle={
            <>
              A light, symbolic reading for today—woven from tropical sun sign, a rough lunar position, and moon phase
              math. Meant as <strong>entertainment</strong>, not a verdict on who you are or what will happen.
            </>
          }
        />

        <div className="hz-banner hz-banner--info" data-testid="hz-banner-info" role="status">
          <p>
            <strong>How it works.</strong> We combine your birth date (and optional time and place for display) with
            today’s sky snapshot—sun sign, approximate moon sign, and illumination—then offer gentle prompts for love,
            career, and personal growth. Nothing here predicts certainty.
          </p>
        </div>

        <aside className="hz-banner hz-banner--legal" data-testid="hz-banner-legal" role="note">
          <p>
            <strong>Entertainment only.</strong> This is not scientific astrology, not medical or legal advice, and not
            a substitute for professional guidance. Moon sign here uses a simple mean-longitude estimate.
          </p>
        </aside>

        <section className="hz-card hz-birth-card" aria-labelledby="hz-birth-heading">
          <div className="hz-birth-card__head">
            <h2 id="hz-birth-heading" className="hz-birth-card__title">
              <IconCalendar />
              Your birth details
            </h2>
          </div>

          <div className="hz-ambience">
            <p className="hz-ambience__copy">
              Optional: tap <strong>Ambience</strong> for a whisper-soft tone synthesized here—off by default, no files
              or uploads.
            </p>
            <button
              type="button"
              className={`hz-switch${ambientOn ? " hz-switch--on" : ""}`}
              role="switch"
              aria-checked={ambientOn}
              data-testid="hz-ambience-toggle"
              onClick={() => {
                if (ambientOn) {
                  stopHoroscopeAmbience();
                  setAmbientOn(false);
                  return;
                }
                touchHoroscopeAmbienceFromUserGesture();
                setAmbientOn(true);
                void startHoroscopeAmbience().catch(() => {
                  stopHoroscopeAmbience();
                  setAmbientOn(false);
                  setErr(
                    "Could not start ambience audio. Try again, or check that this site is allowed to play sound.",
                  );
                });
              }}
            >
              <span className="hz-switch__icon" aria-hidden>
                <IconWave />
              </span>
              <span>{ambientOn ? "Ambience on" : "Ambience off"}</span>
            </button>
          </div>

          <div ref={birthFormRef} className="hz-birth-form" data-testid="hz-birth-form">
            <div className="hz-field">
              <label htmlFor="horoscope-birth-date">Birth date</label>
              <input
                id="horoscope-birth-date"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
                aria-required="true"
              />
            </div>
            <div className="hz-field-row">
              <div className="hz-field">
                <label htmlFor="horoscope-birth-time">Birth time (optional)</label>
                <input
                  id="horoscope-birth-time"
                  type="time"
                  value={birthTime}
                  onChange={(e) => setBirthTime(e.target.value)}
                />
              </div>
              <div className="hz-field hz-field--grow">
                <label htmlFor="horoscope-birth-place">Birth place (optional)</label>
                <input
                  id="horoscope-birth-place"
                  type="text"
                  placeholder="City or region — display only"
                  value={birthPlace}
                  onChange={(e) => setBirthPlace(e.target.value)}
                  maxLength={120}
                  autoComplete="off"
                />
              </div>
            </div>
            <button
              type="button"
              className="hz-submit"
              data-testid="hz-submit"
              disabled={loading || !birthDate.trim()}
              onClick={() => void onGetReading()}
            >
              {loading ? "Reading the sky…" : "Get today’s reading"}
            </button>
          </div>
        </section>

        {hint ? (
          <p className="hz-hint" data-testid="hz-hint">
            {hint}
          </p>
        ) : null}
        {err ? (
          <p className="hz-err" data-testid="hz-error">
            {err}
          </p>
        ) : null}

        {reading ? (
          <div
            key={`${reading.sunSign}-${birthDate}-${reading.moonPhase}`}
            className="hz-results hz-results--animate"
            data-testid="hz-results"
          >
            <section
              className="hz-card hz-snapshot hz-reveal-item"
              aria-label="Sky snapshot"
              data-testid="hz-snapshot"
            >
              <h3 className="hz-snapshot__title">
                <IconSparkles />
                Today’s sky snapshot
              </h3>
              <div className="hz-snapshot-grid">
                <div className="hz-snapshot-cell">
                  <span className="hz-snapshot-cell__label">
                    <IconSun /> Sun sign
                  </span>
                  <span className="hz-snapshot-cell__value">{reading.sunSign}</span>
                  <span className="hz-snapshot-cell__note">From your birth date (tropical)</span>
                </div>
                <div className="hz-snapshot-cell">
                  <span className="hz-snapshot-cell__label">
                    <IconMoon /> Moon (approx.)
                  </span>
                  <span className="hz-snapshot-cell__value">{reading.moonSignApprox}</span>
                  <span className="hz-snapshot-cell__note">Mean longitude — illustrative only</span>
                </div>
                <div className="hz-snapshot-cell">
                  <span className="hz-snapshot-cell__label">
                    <IconSparkles /> Moon phase
                  </span>
                  <span className="hz-snapshot-cell__value">
                    {reading.moonPhase}{" "}
                    <span className="hz-snapshot-cell__illum">({reading.moonIlluminationPercent}% lit)</span>
                  </span>
                </div>
              </div>
              <p className="hz-sky-mood">
                <span className="hz-sky-mood__label">
                  <IconSparkles /> Sky mood
                </span>
                {reading.closing}
              </p>
            </section>

            <div className="hz-columns hz-reveal-item">
              <section className="hz-card hz-pillar" data-testid="hz-love" aria-labelledby="hz-love-h">
                <h4 id="hz-love-h" className="hz-pillar__head">
                  <IconHeart /> Love
                </h4>
                <ul>
                  {reading.love.map((line, i) => (
                    <li key={`love-${i}`}>{line}</li>
                  ))}
                </ul>
              </section>
              <section className="hz-card hz-pillar" data-testid="hz-career" aria-labelledby="hz-career-h">
                <h4 id="hz-career-h" className="hz-pillar__head">
                  <IconBriefcase /> Career
                </h4>
                <ul>
                  {reading.career.map((line, i) => (
                    <li key={`career-${i}`}>{line}</li>
                  ))}
                </ul>
              </section>
              <section className="hz-card hz-pillar" data-testid="hz-growth" aria-labelledby="hz-growth-h">
                <h4 id="hz-growth-h" className="hz-pillar__head">
                  <IconGrowth /> Personal growth
                </h4>
                <ul>
                  {reading.personal.map((line, i) => (
                    <li key={`personal-${i}`}>{line}</li>
                  ))}
                </ul>
              </section>
            </div>

            <p className="hz-disclaimer-closing hz-reveal-item" data-testid="hz-disclaimer-closing">
              {reading.disclaimerHint}
            </p>
          </div>
        ) : null}

        <button type="button" className="hz-cta-more" data-testid="hz-cta-more" onClick={scrollToBirthForm}>
          Curious for more?
          <small>Refine your birth details or request another pass through today’s sky.</small>
        </button>
      </div>
    </div>
  );
}
