import { PracticeContextPanel } from "./PracticeContextPanel";

export type SuggestedPracticePreview = {
  id: number;
  title: string;
  summary: string;
};

const FALLBACK_TITLE = "Seeping Awareness";
const FALLBACK_SUMMARY =
  "Allow awareness to seep into this moment. Notice the present without fixing it.";

type Props = {
  suggested: SuggestedPracticePreview | null;
  onStart: (id?: number) => void;
  /** Heading id for `aria-labelledby` when embedded in a parent card. */
  titleId?: string;
  className?: string;
  /**
   * When set, “Why this one” renders as a compact band below the image area
   * inside the same practice card (Today editorial composition).
   */
  contextDurationLabel?: string;
};

export function SuggestedPracticeFeature({
  suggested,
  onStart,
  titleId = "home-prac",
  className = "",
  contextDurationLabel,
}: Props) {
  const title = suggested?.title ?? FALLBACK_TITLE;
  const summary = suggested ? suggested.summary.slice(0, 170) : FALLBACK_SUMMARY;
  const duration = suggested ? "2–10 min" : "2 min";

  const visual = (
    <>
      <div className="qc-image-card-bg" aria-hidden />
      <div className="qc-image-card-overlay" aria-hidden />
      <div className="qc-image-card-content">
        <p className="qc-eyebrow">Today's practice</p>
        <h3 id={titleId}>{title}</h3>
        <p className="home-p-sum qc-image-card--stone__sum">{summary}</p>
        <div className="qc-image-card-footer">
          <span className="qc-mini-pill">{duration}</span>
          <button type="button" className="btn btn-primary qc-practice-start" onClick={() => onStart(suggested?.id)}>
            <span className="qc-practice-start-icon" aria-hidden>
              ▶
            </span>
            Start
          </button>
        </div>
      </div>
    </>
  );

  const sectionClass =
    "qc-image-card qc-image-card--stone qc-practice-feature qc-practice-feature--stone" +
    (contextDurationLabel != null ? " qc-practice-feature--with-context" : "") +
    (className ? " " + className : "");

  if (contextDurationLabel != null) {
    return (
      <section className={sectionClass} aria-labelledby={titleId}>
        <div className="qc-practice-feature__visual">{visual}</div>
        <PracticeContextPanel durationLabel={contextDurationLabel} />
      </section>
    );
  }

  return (
    <section className={sectionClass} aria-labelledby={titleId}>
      {visual}
    </section>
  );
}
