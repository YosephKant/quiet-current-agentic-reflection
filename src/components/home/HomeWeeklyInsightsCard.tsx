import type { KeyboardEvent } from "react";

type Props = {
  streak: number;
  gratitudeCount: number;
  onOpenInsights: () => void;
};

function ChevronDecor({ className }: { className?: string }) {
  return (
    <svg className={className} width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HomeWeeklyInsightsCard({ streak, gratitudeCount, onOpenInsights }: Props) {
  const streakLabel =
    streak === 0 ? "Start your streak" : streak === 1 ? "1 day rhythm" : `${streak} day rhythm`;
  const weeklyHint =
    gratitudeCount === 0 ? "Log a note to build rhythm" : "Most active in mornings";

  function onCardKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpenInsights();
    }
  }

  return (
    <div
      className="qc-weekly-insights-card"
      tabIndex={0}
      aria-label="Open insights"
      onClick={() => onOpenInsights()}
      onKeyDown={onCardKeyDown}
    >
      <ChevronDecor className="qc-weekly-insights-card__chevron" />

      <p className="qc-eyebrow qc-weekly-insights-card__eyebrow">This week</p>
      <h2 className="qc-weekly-insights-card__title">Your rhythm</h2>
      <p className="qc-weekly-insights-card__lede">A quiet read on how you have been showing up.</p>

      <p className="qc-weekly-insights-card__rhythm-line">{streakLabel}</p>
      <p className="qc-weekly-insights-card__hint-line">{weeklyHint}</p>

      <div className="qc-weekly-insights-card__cta-row">
        <span className="qc-weekly-insights-card__cta">Explore insights →</span>
      </div>
    </div>
  );
}
