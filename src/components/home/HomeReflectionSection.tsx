import { useId } from "react";
import { Card } from "../ui/Card";

export type HomeReflectionSectionProps = {
  onReflect: () => void;
  reflecting: boolean;
  reflection: string | null;
  reflectionMeta: string | null;
  err?: string | null;
};

export function HomeReflectionSection({
  onReflect,
  reflecting,
  reflection,
  reflectionMeta,
  err,
}: HomeReflectionSectionProps) {
  const headingId = useId();

  return (
    <Card className="qc-home-span-2 home-reflection-card" aria-labelledby={headingId}>
      {err ? <p className="err">{err}</p> : null}
      <div className="qc-reflection-head">
        <div>
          <p className="qc-eyebrow">Chat reflection</p>
          <h3 id={headingId}>Turn recent conversations into one useful mirror.</h3>
          <p className="home-card-hint">
            Read your local chat history and generate gentle advice, next steps, and inspiring lines.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onReflect} disabled={reflecting}>
          {reflecting ? "Reflecting…" : "Reflect"}
        </button>
      </div>
      {reflectionMeta ? <p className="home-meta">{reflectionMeta}</p> : null}
      {reflection ? <pre className="home-reflection-output">{reflection}</pre> : null}
    </Card>
  );
}
