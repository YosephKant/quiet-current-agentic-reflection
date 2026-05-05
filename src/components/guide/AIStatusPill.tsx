export function AIStatusPill({
  personaName = "Presence",
  personaLabel = "Built-in calm voice",
}: {
  personaName?: string;
  personaLabel?: string;
}) {
  return (
    <div className="qc-ai-status-pill">
      <span className="qc-ai-status-pill__label">AI guide</span>
      <span className="qc-ai-status-pill__sub">
        Persona: <strong>{personaName}</strong> - {personaLabel}
      </span>
    </div>
  );
}
