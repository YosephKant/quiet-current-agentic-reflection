type Props = {
  /** Duration chip, e.g. "2–10 min" */
  durationLabel: string;
};

const BODY =
  "A short reset for when the mind is trying to manufacture calm.";

export function PracticeContextPanel({ durationLabel }: Props) {
  return (
    <aside className="qc-practice-context-panel" aria-label="Why this practice">
      <h2 className="qc-practice-context-panel__title">Why this one</h2>
      <p className="qc-practice-context-panel__body">{BODY}</p>
      <div className="qc-practice-context-panel__chips">
        <span className="qc-practice-context-panel__chip">{durationLabel}</span>
        <span className="qc-practice-context-panel__chip">zen</span>
        <span className="qc-practice-context-panel__chip">beginner</span>
      </div>
    </aside>
  );
}
