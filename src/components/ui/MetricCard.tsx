import type { ReactNode } from "react";
import { Card } from "./Card";

export function MetricCard({
  label,
  value,
  hint,
  className = "",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <Card variant="muted" className={"qc-metric-card " + className} aria-label={label}>
      <h3 className="qc-metric-label">{label}</h3>
      <p className="qc-metric-value">{value}</p>
      {hint ? <p className="qc-metric-hint home-card-hint">{hint}</p> : null}
    </Card>
  );
}
