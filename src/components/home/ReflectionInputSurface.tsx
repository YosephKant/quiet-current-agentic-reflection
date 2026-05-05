import type { QuickTemplateKind } from "./QuickTemplatesCard";

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

const STARTERS: { kind: QuickTemplateKind; label: string; hint: string }[] = [
  { kind: "gratitude", label: "Gratitude", hint: "What are you grateful for?" },
  { kind: "reflection", label: "Reflection", hint: "What did you learn today?" },
  { kind: "intention", label: "Intention", hint: "How do you want to show up?" },
  { kind: "idea", label: "Idea", hint: "Capture a thought or idea." },
];

const SWATCH: Record<QuickTemplateKind, string> = {
  gratitude: "qc-home-template-swatch--amber",
  reflection: "qc-home-template-swatch--violet",
  intention: "qc-home-template-swatch--sky",
  idea: "qc-home-template-swatch--coral",
};

export type ReflectionInputSurfaceProps = {
  intention: string;
  onChangeIntention: (value: string) => void;
  statsOptIn: boolean;
  onToggleOptIn: (checked: boolean) => void;
  onSave: () => void;
  saving: boolean;
  intentionId: string;
  onPickTemplate: (kind: QuickTemplateKind) => void;
  /** Extra classes (e.g. Today feature-row companion). */
  className?: string;
  /**
   * `full` — intention + note starters (default).
   * `intention` | `starters` — single column for Today editorial layout (intention above starters).
   */
  segment?: "full" | "intention" | "starters";
};

export function ReflectionInputSurface({
  intention,
  onChangeIntention,
  statsOptIn,
  onToggleOptIn,
  onSave,
  saving,
  intentionId,
  onPickTemplate,
  className = "",
  segment = "full",
}: ReflectionInputSurfaceProps) {
  const intentionHeadingId = `${intentionId}-heading`;
  const startersHeadingId = `${intentionId}-starters-heading`;

  const intentionCol = (
    <div className="qc-reflection-input-surface__col qc-reflection-input-surface__col--intention">
      <p className="qc-eyebrow qc-reflection-input-surface__eyebrow">Light input</p>
      <h2 id={intentionHeadingId} className="qc-reflection-input-surface__title">
        Set your intention
      </h2>
      <p className="qc-reflection-input-surface__lede">A line to remember why you opened the app.</p>
      <label htmlFor={intentionId} className="sr-only">
        Intention
      </label>
      <textarea
        id={intentionId}
        className="home-intention qc-input qc-textarea-like qc-reflection-input-surface__textarea"
        rows={3}
        value={intention}
        onChange={(e) => onChangeIntention(e.target.value)}
        placeholder="e.g. return gently, without performance"
        maxLength={2000}
        aria-labelledby={intentionHeadingId}
      />
      <label className="home-check qc-reflection-input-surface__check">
        <input type="checkbox" checked={statsOptIn} onChange={(e) => onToggleOptIn(e.target.checked)} />
        Soft visit streak, local only
      </label>
      <button type="button" className="btn btn-secondary qc-reflection-input-surface__save" onClick={onSave} disabled={saving}>
        <IconSparkle className="qc-intention-save-icon" aria-hidden />
        {saving ? "Saving..." : segment === "intention" ? "Save intention" : "Save"}
      </button>
    </div>
  );

  const startersCol = (
    <div className="qc-reflection-input-surface__col qc-reflection-input-surface__col--starters" aria-labelledby={startersHeadingId}>
      {segment !== "starters" ? (
        <p className="qc-eyebrow qc-reflection-input-surface__eyebrow">Optional</p>
      ) : null}
      <h2 id={startersHeadingId} className="qc-reflection-input-surface__title qc-reflection-input-surface__title--quiet">
        Note starters
      </h2>
      <p className="qc-reflection-input-surface__lede qc-reflection-input-surface__lede--quiet">
        Open your journal with a shape in mind.
      </p>
      <div className="qc-reflection-input-surface__starter-list">
        {STARTERS.map(({ kind, label, hint }) => (
          <button
            key={kind}
            type="button"
            className="btn qc-reflection-input-surface__starter"
            onClick={() => onPickTemplate(kind)}
          >
            <span className={`qc-home-template-swatch ${SWATCH[kind]}`} aria-hidden />
            <span className="qc-reflection-input-surface__starter-copy">
              <span className="qc-reflection-input-surface__starter-label">{label}</span>
              <span className="qc-reflection-input-surface__starter-hint">{hint}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  if (segment === "intention") {
    return (
      <section
        className={"qc-reflection-input-surface" + (className ? " " + className : "")}
        aria-label="Set your intention"
      >
        <div className="qc-reflection-input-surface__grid qc-reflection-input-surface__grid--segment">
          {intentionCol}
        </div>
      </section>
    );
  }

  if (segment === "starters") {
    return (
      <section className={"qc-reflection-input-surface" + (className ? " " + className : "")} aria-label="Note starters">
        <div className="qc-reflection-input-surface__grid qc-reflection-input-surface__grid--segment">
          {startersCol}
        </div>
      </section>
    );
  }

  return (
    <section
      className={"qc-reflection-input-surface" + (className ? " " + className : "")}
      aria-label="Intention and note starters"
    >
      <div className="qc-reflection-input-surface__grid">
        {intentionCol}
        {startersCol}
      </div>
    </section>
  );
}
