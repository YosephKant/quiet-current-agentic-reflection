import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { formatApiErrorMessage, readApiJson } from "../lib/readApiJson";
import {
  startHoroscopeAmbience,
  stopHoroscopeAmbience,
  touchHoroscopeAmbienceFromUserGesture,
} from "../lib/horoscopeAmbience";
import heroBg from "../assets/horoscope/hero-bg.png";
import starsOverlay from "../assets/horoscope/stars-overlay.png";
import grain from "../assets/horoscope/grain.png";
import sunIcon from "../assets/horoscope/sun.svg";
import moonIcon from "../assets/horoscope/moon.svg";
import phaseIcon from "../assets/horoscope/phase.svg";
import heartIcon from "../assets/horoscope/heart.svg";
import briefcaseIcon from "../assets/horoscope/briefcase.svg";
import growthIcon from "../assets/horoscope/growth.svg";
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

type HoroscopeUiState = "empty" | "ready" | "loading" | "generated" | "error";
type PillarKey = "love" | "career" | "personal";

const today = new Date();

function toDateInputValue(date: Date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatReadingDate(date: Date) {
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);

  if (toDateInputValue(date) === toDateInputValue(today)) {
    return `Today, ${dateLabel}`;
  }

  return dateLabel;
}

function cleanLines(lines: string[]) {
  return lines
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .slice(0, 3);
}

function IconImage({ src, alt = "" }: { src: string; alt?: string }) {
  return <img className="hz-icon-img" src={src} alt={alt} aria-hidden={alt ? undefined : true} />;
}

function LoadingSkyCard() {
  return (
    <section className="hz-reading-card hz-reading-card--loading" data-testid="hz-loading-card" aria-live="polite">
      <div className="hz-reading-card__stars" aria-hidden />
      <div className="hz-reading-card__grain" aria-hidden />
      <div className="hz-loading-copy">
        <span className="hz-kicker">Your sky today</span>
        <h3>Reading the shape of the day...</h3>
        <p>A quiet reflection is forming from the details you shared.</p>
      </div>
      <div className="hz-shimmer" aria-hidden />
    </section>
  );
}

function GuidanceCard({
  icon,
  title,
  lines,
  active,
  onToggle,
}: {
  icon: string;
  title: string;
  lines: string[];
  active: boolean;
  onToggle: () => void;
}) {
  const visibleLines = active ? lines : lines.slice(0, 3);

  return (
    <button
      type="button"
      className={`hz-guidance-card${active ? " hz-guidance-card--active" : ""}`}
      onClick={onToggle}
      aria-expanded={active}
    >
      <span className="hz-guidance-card__head">
        <IconImage src={icon} />
        <h4>{title}</h4>
      </span>
      <ul>
        {visibleLines.map((line, i) => (
          <li key={`${title}-${i}`}>{line}</li>
        ))}
      </ul>
      {active ? <span className="hz-guidance-card__more">Let this stay symbolic and optional.</span> : null}
    </button>
  );
}

export function HoroscopePanel() {
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [readingDate, setReadingDate] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [dateTransitioning, setDateTransitioning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [reading, setReading] = useState<HoroscopeResponse | null>(null);
  const [ambientOn, setAmbientOn] = useState(false);
  const [expandedPillar, setExpandedPillar] = useState<PillarKey | null>(null);
  const birthFormRef = useRef<HTMLDivElement>(null);

  const hasValidBirthDate = birthDate.trim().length > 0;
  const uiState: HoroscopeUiState = loading ? "loading" : err ? "error" : reading ? "generated" : hasValidBirthDate ? "ready" : "empty";
  const readingLines = reading
    ? {
        love: cleanLines(reading.love),
        career: cleanLines(reading.career),
        personal: cleanLines(reading.personal),
      }
    : null;

  const horoscopeStyle = {
    "--hz-hero-bg": `url(${heroBg})`,
    "--hz-stars": `url(${starsOverlay})`,
    "--hz-grain": `url(${grain})`,
  } as CSSProperties;

  useEffect(() => {
    if (!ambientOn) {
      stopHoroscopeAmbience();
    }
  }, [ambientOn]);

  useEffect(() => () => stopHoroscopeAmbience(), []);

  async function onGetReading(targetDate = readingDate) {
    if (!birthDate.trim()) return;

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
          readingDate: toDateInputValue(targetDate),
        }),
      });
      const { ok, json } = await readApiJson<HoroscopeResponse & { error?: string; hint?: string }>(r);
      if (!ok) {
        setReading(null);
        setErr(formatApiErrorMessage(json, "Something did not load. Try again in a moment."));
        return;
      }
      setReading(json as HoroscopeResponse);
      if (json.fallback) {
        setHint("Model unavailable; showing a gentle local reading from today's sky math.");
      }
    } catch {
      setReading(null);
      setErr("Something did not load. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  function changeReadingDate(days: number) {
    const next = addDays(readingDate, days);
    setReadingDate(next);
    setDateTransitioning(true);
    window.setTimeout(() => setDateTransitioning(false), 180);
    if (birthDate.trim() && reading) {
      void onGetReading(next);
    }
  }

  function scrollToBirthForm() {
    birthFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const first = birthFormRef.current?.querySelector<HTMLInputElement>("input");
    window.setTimeout(() => first?.focus(), 300);
  }

  return (
    <div className="panel horoscope-panel qc-horoscope-flow hz-tab" style={horoscopeStyle} data-state={uiState}>
      <div className="hz-tab__stars" aria-hidden />
      <div className="hz-tab__grain" aria-hidden />
      <div className="hz-tab__inner">
        <PageHeader
          title="Horoscope"
          subtitle="A quiet reflection of today's sky."
          actions={
            <button
              type="button"
              className="hz-primary-cta"
              data-testid="hz-header-submit"
              disabled={loading || !hasValidBirthDate}
              onClick={() => void onGetReading()}
            >
              {loading ? "Reading today's sky" : "Get today's reading"}
            </button>
          }
        />

        <div className="hz-date-row" aria-label="Reading date">
          <button type="button" className="hz-date-arrow" aria-label="Previous day" onClick={() => changeReadingDate(-1)}>
            {"<"}
          </button>
          <div className={`hz-date-pill${dateTransitioning ? " hz-date-pill--fade" : ""}`}>
            <span>{formatReadingDate(readingDate)}</span>
          </div>
          <button type="button" className="hz-date-arrow" aria-label="Next day" onClick={() => changeReadingDate(1)}>
            {">"}
          </button>
        </div>

        <div className="hz-trust-note" role="note">
          <IconImage src={phaseIcon} />
          <p>
            Nothing here predicts certainty. It offers symbolic reflection for love, career, and personal growth.
          </p>
        </div>

        <section className={`hz-intake-card${reading ? " hz-intake-card--compact" : ""}`} aria-labelledby="hz-birth-heading">
          <div className="hz-intake-card__message">
            <span className="hz-kicker">{uiState === "empty" ? "Start here" : "Birth details"}</span>
            <h3 id="hz-birth-heading">
              {uiState === "empty" ? "Enter your birth details to see today's sky." : "Your birth details"}
            </h3>
            <p>Nothing here predicts certainty - it offers reflection.</p>
          </div>

          <div className="hz-ambience">
            <span>Ambience</span>
            <button
              type="button"
              className={`hz-switch${ambientOn ? " hz-switch--on" : ""}`}
              role="switch"
              aria-checked={ambientOn}
              aria-label={ambientOn ? "Ambience on" : "Ambience off"}
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
                  setErr("Something did not load. Try again in a moment.");
                });
              }}
            >
              {ambientOn ? "On" : "Off"}
            </button>
          </div>

          <div ref={birthFormRef} className="hz-birth-form" data-testid="hz-birth-form">
            <div className="hz-field">
              <label htmlFor="horoscope-birth-date">Birth date</label>
              <input
                id="horoscope-birth-date"
                type="date"
                value={birthDate}
                onChange={(e) => {
                  setBirthDate(e.target.value);
                  if (!e.target.value) setReading(null);
                }}
                required
                aria-required="true"
              />
            </div>
            <div className="hz-field">
              <label htmlFor="horoscope-birth-time">Birth time optional</label>
              <input
                id="horoscope-birth-time"
                type="time"
                value={birthTime}
                onChange={(e) => setBirthTime(e.target.value)}
              />
            </div>
            <div className="hz-field hz-field--grow">
              <label htmlFor="horoscope-birth-place">Birth place optional</label>
              <input
                id="horoscope-birth-place"
                type="text"
                placeholder="City or region - display only"
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
                maxLength={120}
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              className="hz-submit"
              data-testid="hz-submit"
              disabled={loading || !hasValidBirthDate}
              onClick={() => void onGetReading()}
            >
              {loading ? "Reading today's sky" : "Get today's reading"}
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
            Something did not load. Try again in a moment.
          </p>
        ) : null}

        {!reading && loading ? <LoadingSkyCard /> : null}

        {reading && readingLines ? (
          <div
            key={`${reading.sunSign}-${readingDate.toISOString()}-${reading.moonPhase}`}
            className={`hz-results hz-results--animate${dateTransitioning ? " hz-results--crossfade" : ""}${
              loading ? " hz-results--loading" : ""
            }`}
            data-testid="hz-results"
          >
            <section className="hz-reading-card hz-reveal-item" aria-label="Sky snapshot" data-testid="hz-snapshot">
              <div className="hz-reading-card__stars" aria-hidden />
              <div className="hz-reading-card__grain" aria-hidden />
              <div className="hz-reading-card__haze" aria-hidden />
              <div className="hz-reading-card__moon" aria-hidden />
              {loading ? <div className="hz-shimmer" aria-hidden /> : null}

              <div className="hz-reading-card__content">
                <span className="hz-kicker">Your sky today</span>
                <h3>
                  <span>Today's gentle breeze</span>
                  <span>carries whispers</span>
                  <span>of transformation.</span>
                </h3>
                <p>
                  Today's sky supports steady choices and honest reflection. Take what feels useful and leave the rest.
                </p>

                <div className="hz-sky-facts" aria-label="Sky details">
                  <div>
                    <span>
                      <IconImage src={sunIcon} /> Sun sign
                    </span>
                    <strong>{reading.sunSign}</strong>
                  </div>
                  <div>
                    <span>
                      <IconImage src={moonIcon} /> Moon approx.
                    </span>
                    <strong>{reading.moonSignApprox}</strong>
                  </div>
                  <div>
                    <span>
                      <IconImage src={phaseIcon} /> Moon phase
                    </span>
                    <strong>
                      {reading.moonPhase} <small>{reading.moonIlluminationPercent}% lit</small>
                    </strong>
                  </div>
                </div>
              </div>
            </section>

            <div className="hz-guidance-grid hz-reveal-item">
              <GuidanceCard
                icon={heartIcon}
                title="Love"
                lines={readingLines.love}
                active={expandedPillar === "love"}
                onToggle={() => setExpandedPillar(expandedPillar === "love" ? null : "love")}
              />
              <GuidanceCard
                icon={briefcaseIcon}
                title="Career"
                lines={readingLines.career}
                active={expandedPillar === "career"}
                onToggle={() => setExpandedPillar(expandedPillar === "career" ? null : "career")}
              />
              <GuidanceCard
                icon={growthIcon}
                title="Personal growth"
                lines={readingLines.personal}
                active={expandedPillar === "personal"}
                onToggle={() => setExpandedPillar(expandedPillar === "personal" ? null : "personal")}
              />
            </div>

            <div className="hz-refresh-strip hz-reveal-item">
              <div>
                <span className="hz-kicker">Curious for more?</span>
                <p>Refine your birth details or request another pass through today's sky.</p>
              </div>
              <button type="button" onClick={() => void onGetReading()}>
                Refresh reading
              </button>
            </div>

            <p className="hz-disclaimer-closing hz-reveal-item" data-testid="hz-disclaimer-closing">
              {reading.disclaimerHint}
            </p>
          </div>
        ) : null}

        {!reading && !loading ? (
          <button type="button" className="hz-cta-more" data-testid="hz-cta-more" onClick={scrollToBirthForm}>
            {uiState === "empty" ? "Enter details to begin" : "Ready when you are"}
            <small>{uiState === "empty" ? "Birth date is the only required field." : "Use the primary button above."}</small>
          </button>
        ) : null}
      </div>
    </div>
  );
}
