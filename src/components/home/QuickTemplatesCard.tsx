import { Card } from "../ui/Card";

export type QuickTemplateKind = "gratitude" | "reflection" | "intention" | "idea";

const ROWS: { kind: QuickTemplateKind; label: string; hint: string }[] = [
  { kind: "gratitude", label: "Gratitude", hint: "What are you grateful for?" },
  { kind: "reflection", label: "Reflection", hint: "What did you learn today?" },
  { kind: "intention", label: "Intention", hint: "How do you want to show up?" },
  { kind: "idea", label: "Idea", hint: "Capture a thought or idea." },
];

type Props = {
  onPick: (kind: QuickTemplateKind) => void;
  className?: string;
};

const SWATCH: Record<QuickTemplateKind, string> = {
  gratitude: "qc-home-template-swatch--amber",
  reflection: "qc-home-template-swatch--violet",
  intention: "qc-home-template-swatch--sky",
  idea: "qc-home-template-swatch--coral",
};

export function QuickTemplatesCard({ onPick, className = "" }: Props) {
  return (
    <Card
      className={
        "qc-template-card qc-home-quick-templates" + (className ? " " + className : "")
      }
    >
      <h2 className="qc-template-card__title">Quick templates</h2>
      <p className="home-card-hint qc-template-card__hint">One tap opens your journal with a gentle shape in mind.</p>
      <div className="qc-home-quick-actions qc-home-quick-templates-actions">
        {ROWS.map(({ kind, label, hint }) => (
          <button
            key={kind}
            type="button"
            className="btn qc-quick-action qc-home-template-row"
            onClick={() => onPick(kind)}
          >
            <span className={`qc-home-template-swatch ${SWATCH[kind]}`} aria-hidden />
            <span className="qc-home-template-row-copy">
              <span className="qc-home-template-row-label">{label}</span>
              <span className="qc-home-template-row-hint">{hint}</span>
            </span>
            <span className="qc-home-template-chevron" aria-hidden>
              ›
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}
