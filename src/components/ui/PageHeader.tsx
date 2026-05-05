import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
  className = "",
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={"qc-page-header " + className}>
      <div className="qc-page-header-text">
        <h2 className="qc-page-title">{title}</h2>
        {subtitle != null && subtitle !== false ? (
          <p className="qc-page-subtitle subtitle">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="qc-page-header-actions">{actions}</div> : null}
    </header>
  );
}
