import { useId } from "react";

type ContinueThreadCardProps = {
  sessionTitle: string | null;
  onResume: (sessionId?: number) => void;
  sessionId?: number | null;
};

export function ContinueThreadCard({ sessionTitle, onResume, sessionId }: ContinueThreadCardProps) {
  const headingId = useId();
  const hasThread = sessionTitle !== null;
  const displayTitle = (sessionTitle ?? "").trim() || "Guide";

  return (
    <section className="qc-continue-card qc-continue-card--reference" aria-labelledby={headingId}>
      <div className="qc-continue-card__col qc-continue-card__col--lead">
        <h2 id={headingId} className="qc-continue-card__title">
          Continue your thread
        </h2>
        <p className="qc-continue-card__sub">Pick up where you left off.</p>
      </div>
      <div className="qc-journey-line" aria-hidden="true">
        <svg className="qc-journey-line__svg" viewBox="0 0 320 72" preserveAspectRatio="xMidYMid meet" role="presentation">
          <path
            className="qc-journey-line__path"
            d="M 12 44 C 88 12, 168 58, 308 28"
          />
          <circle className="qc-journey-line__dot" cx="308" cy="28" r="5" />
        </svg>
      </div>
      <div className="qc-continue-card__col qc-continue-card__col--cta">
        <p className="qc-continue-card__hint">Return to the thread that already knows your context.</p>
        {hasThread ? (
          <button
            type="button"
            className="qc-continue-card__btn btn btn-primary home-cta"
            onClick={() => onResume(sessionId ?? undefined)}
            aria-label={`Resume guided chat: ${displayTitle}`}
          >
            Resume: {displayTitle}
          </button>
        ) : (
          <button
            type="button"
            className="qc-continue-card__btn btn btn-primary home-cta"
            onClick={() => onResume()}
            aria-label="Open the guided chat without resuming a thread"
          >
            Open guide
          </button>
        )}
      </div>
    </section>
  );
}
