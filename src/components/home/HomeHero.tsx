import type { CSSProperties } from "react";

type HomeHeroProps = {
  greetingTitle: string;
  /** Product line woven into the hero (same copy as the global tagline on other tabs). */
  ambientTagline?: string;
  /** Primary subtitle under the greeting (design anchor line). */
  subtitle: string;
  onOpenNotes: () => void;
  onOpenChat: () => void;
  onOpenWeekly: () => void;
  onStartReset: () => void;
  /** Softer “evening” contrast for the Today canvas (persisted in `localStorage`). */
  comfortDim?: boolean;
  onComfortToggle?: () => void;
};

export const DAILY_HOME_BACKGROUNDS = [
  "/textures/quiet-current/hero_morning_alpine_lake.png",
  "/textures/quiet-current/hero_serene_lake_sunrise_mist.png",
  "/textures/quiet-current/hero_golden_dawn_still_lake.png",
] as const;

export function imageForToday(images: readonly string[], date = new Date()): string {
  const dayKey = Math.floor(date.getTime() / 86_400_000);
  return images[dayKey % images.length];
}

function IconSunSmall({ className }: { className?: string }) {
  return (
    <svg className={className} width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPlay({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" />
    </svg>
  );
}

function IconPencil({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M4 13l8-8a2 2 0 0 1 2.8 0l1.4 1.4a2 2 0 0 1 0 2.8l-8 8H4v-4Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMessageCircle({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7.5 18.5 4 20l1-3.2A7.1 7.1 0 0 1 3.5 12.5C3.5 8.4 7.3 5 12 5s8.5 3.4 8.5 7.5S16.7 20 12 20a9.4 9.4 0 0 1-4.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3.5v3M17 3.5v3M4.5 9.5h15M6.5 5h11A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMoon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 14.5A8.5 8.5 0 0 1 9.5 3a8.4 8.4 0 0 0 1.7 9.8A8.4 8.4 0 0 0 21 14.5Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSunToggle({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HomeHero({
  greetingTitle,
  ambientTagline,
  subtitle,
  onOpenNotes,
  onOpenChat,
  onOpenWeekly,
  onStartReset,
  comfortDim = false,
  onComfortToggle,
}: HomeHeroProps) {
  const heroStyle = {
    "--qc-home-hero-image": `url("${imageForToday(DAILY_HOME_BACKGROUNDS)}")`,
  } as CSSProperties;

  return (
    <section className="qc-home-hero" style={heroStyle} aria-label="Today">
      <div className="qc-home-hero-bg" aria-hidden="true" />
      <div className="qc-home-hero-overlay" aria-hidden="true" />
      {onComfortToggle ? (
        <div className="qc-home-hero-chrome">
          <button
            type="button"
            className="qc-hero-theme-toggle"
            onClick={onComfortToggle}
            aria-pressed={comfortDim}
            aria-label={comfortDim ? "Use brighter Today appearance" : "Use softer Today appearance"}
          >
            {comfortDim ? (
              <IconMoon className="qc-hero-theme-toggle-icon" />
            ) : (
              <IconSunToggle className="qc-hero-theme-toggle-icon" />
            )}
          </button>
        </div>
      ) : null}
      <div className="qc-home-hero-content">
        {ambientTagline ? <p className="qc-hero-app-caption">{ambientTagline}</p> : null}
        <h1 className="qc-home-greeting-title">
          <IconSunSmall className="qc-hero-title-sun" aria-hidden />
          <span className="qc-home-greeting-text">{greetingTitle}</span>
        </h1>
        <p className="qc-hero-lede">{subtitle}</p>
        <div className="qc-hero-actions">
          <button type="button" className="qc-hero-pill qc-hero-pill--primary" onClick={onStartReset}>
            <IconPlay className="qc-hero-pill-icon" />
            Start a practice
          </button>
        </div>
        <div className="qc-hero-secondary-actions" aria-label="Secondary Today actions">
          <button type="button" className="qc-hero-pill qc-hero-pill--quiet" onClick={onOpenNotes}>
            <IconPencil className="qc-hero-pill-icon" />
            Log note
          </button>
          <button type="button" className="qc-hero-pill qc-hero-pill--quiet" onClick={onOpenChat}>
            <IconMessageCircle className="qc-hero-pill-icon" />
            Guided chat
          </button>
          <button type="button" className="qc-hero-pill qc-hero-pill--quiet" onClick={onOpenWeekly}>
            <IconCalendar className="qc-hero-pill-icon" />
            Weekly review
          </button>
        </div>
      </div>
    </section>
  );
}
