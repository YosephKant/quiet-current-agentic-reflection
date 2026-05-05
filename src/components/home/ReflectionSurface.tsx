import type { HomeSnapshot } from "../../types";

export type ReflectionSurfaceProps = {
  lastNote: HomeSnapshot["lastNote"];
  streak: number;
  statsOptIn: boolean;
  onReflect: () => void;
  reflecting: boolean;
  reflection: string | null;
  reflectionMeta: string | null;
  onOpenInsights: () => void;
  /** Centered, narrower “closing moment” layout for Today. */
  layout?: "default" | "anchor";
  /** When false (e.g. home grid), hide “Go deeper” because another surface links to insights. */
  anchorShowDeeperLink?: boolean;
};

function rhythmPhrase(streak: number, statsOptIn: boolean): string | null {
  if (!statsOptIn) return null;
  const n = Math.max(0, Math.floor(streak));
  if (n === 0) return null;
  if (n === 1) return "1-day rhythm";
  return `${n}-day rhythm`;
}

export function ReflectionSurface({
  lastNote,
  streak,
  statsOptIn,
  onReflect,
  reflecting,
  reflection,
  reflectionMeta,
  onOpenInsights,
  layout = "default",
  anchorShowDeeperLink = true,
}: ReflectionSurfaceProps) {
  const line = (lastNote?.lastLine ?? "").trim();
  const hasNote = line.length > 0;
  const rhythm = rhythmPhrase(streak, statsOptIn);
  const anchor = layout === "anchor";
  const cue = hasNote ? (line.length > 118 ? `${line.slice(0, 115)}…` : line) : null;

  const defaultInner = (
    <>
      <h2 id="qc-reflection-surface-title" className="qc-reflection-surface__title">
        Reflect on your day
      </h2>

      {hasNote ? (
        <p className="qc-reflection-surface__note">{line}</p>
      ) : (
        <p className="qc-reflection-surface__placeholder">Capture one honest sentence.</p>
      )}

      {rhythm ? <p className="qc-reflection-surface__rhythm">{rhythm}</p> : null}

      <p className="qc-reflection-surface__support">Turn recent moments into one useful reflection.</p>

      <div className="qc-reflection-surface__actions">
        <button type="button" className="btn btn-primary qc-reflection-surface__cta" onClick={onReflect} disabled={reflecting} aria-busy={reflecting}>
          {reflecting === true ? "Reflecting…" : "Reflect"}
        </button>
      </div>

      {reflectionMeta ? <p className="qc-reflection-surface__meta">{reflectionMeta}</p> : null}
      {reflection ? <pre className="qc-reflection-surface__output">{reflection}</pre> : null}
    </>
  );

  const reflectionBody = (reflection ?? "").trim();
  const hasReflection = reflectionBody.length > 0;

  const anchorInner = (
    <>
      <p className="qc-reflection-waterfall__kicker">Reflection</p>
      <h2 id="qc-reflection-surface-title" className="qc-reflection-waterfall__title">
        Reflect on your day
      </h2>
      <p className="qc-reflection-waterfall__subtitle">Turn recent moments into one useful reflection.</p>
      {cue ? <p className="qc-reflection-waterfall__cue">{cue}</p> : null}

      <div className="qc-reflection-waterfall__reserve">
        {hasReflection ? (
          <>
            {reflectionMeta ? <p className="qc-reflection-waterfall__meta">{reflectionMeta}</p> : null}
            <div className="qc-reflection-waterfall__preview-scroll">
              <pre className="qc-reflection-waterfall__output qc-reflection-waterfall__output--in-card">{reflectionBody}</pre>
            </div>
            {reflectionBody.length > 280 ? (
              <button type="button" className="qc-reflection-waterfall__full-link" onClick={onOpenInsights}>
                View full reflection →
              </button>
            ) : null}
          </>
        ) : (
          <div className="qc-reflection-waterfall__empty-panel">
            <p className="qc-reflection-waterfall__empty-hint">When you reflect, a short summary will appear here.</p>
          </div>
        )}
      </div>

      <div className="qc-image-card-footer qc-reflection-waterfall__footer">
        {rhythm ? <span className="qc-mini-pill">{rhythm}</span> : <span className="qc-reflection-waterfall__footer-spacer" aria-hidden />}
        <button type="button" className="btn btn-primary qc-reflection-surface__cta" onClick={onReflect} disabled={reflecting} aria-busy={reflecting}>
          {reflecting === true ? "Reflecting…" : "Reflect"}
        </button>
      </div>

      <p className="qc-reflection-waterfall__insights-row">
        <button type="button" className="qc-reflection-waterfall__insights-link" onClick={onOpenInsights}>
          View insights →
        </button>
      </p>
    </>
  );

  return (
    <div className={"qc-reflection-surface-stack" + (anchor ? " qc-reflection-surface-stack--anchor" : "")}>
      {anchor ? (
        <section
          className="qc-image-card qc-image-card--waterfall qc-reflection-surface qc-reflection-surface--anchor"
          aria-labelledby="qc-reflection-surface-title"
        >
          <div className="qc-image-card-bg" aria-hidden />
          <div className="qc-image-card-overlay" aria-hidden />
          <div className="qc-image-card-content qc-reflection-waterfall__content">{anchorInner}</div>
        </section>
      ) : (
        <section className="qc-reflection-surface" aria-labelledby="qc-reflection-surface-title">
          {defaultInner}
        </section>
      )}

      {(!anchor || anchorShowDeeperLink) && (
        <p className="qc-reflection-surface__deeper">
          <button type="button" className="qc-reflection-surface__deeper-link" onClick={onOpenInsights}>
            Go deeper → Explore insights
          </button>
        </p>
      )}
    </div>
  );
}
