import type { ReactNode } from "react";

export function AppShell({
  sidebar,
  children,
  mobileNav,
}: {
  sidebar: ReactNode;
  children: ReactNode;
  mobileNav?: ReactNode;
}) {
  return (
    <div className="qc-app qc-app-ambient app-ambient">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="qc-app-grid">
        {sidebar}
        <div className="qc-main-column">
          <div className="qc-main-inner">{children}</div>
        </div>
      </div>
      {mobileNav}
    </div>
  );
}
