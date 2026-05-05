import type { ReactNode } from "react";

export function EmptyState({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={"qc-empty-state empty-state " + className}>{children}</p>;
}
