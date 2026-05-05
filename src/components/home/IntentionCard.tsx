import { Card } from "../ui/Card";

function IconSparkle({ className }: { className?: string }) {
  return (
    <svg className={className} width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2l1.2 4.4L18 8l-4.8 1.6L12 14l-1.2-4.4L6 8l4.8-1.6L12 2Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M19 15l.5 1.8 1.8.5-1.8.5-.5 1.8-.5-1.8-1.8-.5 1.8-.5.5-1.8Z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}

type Props = {
  intention: string;
  onChangeIntention: (value: string) => void;
  statsOptIn: boolean;
  onToggleOptIn: (checked: boolean) => void;
  onSave: () => void;
  saving: boolean;
  intentionId: string;
  className?: string;
};

export function IntentionCard({
  intention,
  onChangeIntention,
  statsOptIn,
  onToggleOptIn,
  onSave,
  saving,
  intentionId,
  className = "",
}: Props) {
  const headingId = `${intentionId}-heading`;

  return (
    <Card
      aria-labelledby={headingId}
      className={
        "qc-intention-card qc-home-intention-card" + (className ? " " + className : "")
      }
    >
      <p className="qc-eyebrow">Intention</p>
      <h2 id={headingId} className="qc-intention-card__title">
        Set your intention
      </h2>
      <p className="qc-intention-card__lede">A line to remember why you opened the app.</p>
      <label htmlFor={intentionId} className="sr-only">
        Intention
      </label>
      <textarea
        id={intentionId}
        className="home-intention qc-input qc-textarea-like"
        rows={2}
        value={intention}
        onChange={(e) => onChangeIntention(e.target.value)}
        placeholder="e.g. return gently, without performance"
        maxLength={2000}
      />
      <label className="home-check">
        <input
          type="checkbox"
          checked={statsOptIn}
          onChange={(e) => onToggleOptIn(e.target.checked)}
        />
        Soft visit streak, local only
      </label>
      <button type="button" className="btn btn-primary qc-intention-save" onClick={onSave} disabled={saving}>
        <IconSparkle className="qc-intention-save-icon" />
        {saving ? "Saving…" : "Save intention"}
      </button>
    </Card>
  );
}
