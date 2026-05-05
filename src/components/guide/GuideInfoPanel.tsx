import type { ReactNode } from "react";

export function GuideInfoPanel({ children }: { children: ReactNode }) {
  return <div className="qc-guide-info-panel">{children}</div>;
}
