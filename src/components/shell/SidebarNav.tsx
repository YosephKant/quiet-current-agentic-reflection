import type { Tab } from "../../types";
import { Button } from "../ui/Button";

export type NavItem = { id: Tab; label: string };

const NAV_ICONS: Partial<Record<Tab, string>> = {
  home: "⌂",
  practices: "◐",
  chat: "✦",
  notes: "✎",
  insights: "◌",
  weekly: "↻",
  horoscope: "☾",
  guide_builder: "◇",
  habits: "☷",
  privacy: "◎",
};

function profileInitial(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  return t.slice(0, 1).toUpperCase();
}

export function SidebarNav({
  items,
  activeTab,
  onSelect,
  streak,
  statsOptIn,
  onOpenMobileMenu,
  profileName,
  onOpenSettings,
}: {
  items: readonly NavItem[];
  activeTab: Tab;
  onSelect: (id: Tab) => void;
  streak: number;
  statsOptIn: boolean;
  onOpenMobileMenu?: () => void;
  /** Shown beside Settings; uses `qc_display_name` from Privacy when wired in App. */
  profileName?: string;
  onOpenSettings?: () => void;
}) {
  return (
    <aside className="qc-sidebar" aria-label="App">
      <div className="qc-sidebar-brand">
        {onOpenMobileMenu ? (
          <Button
            variant="icon"
            className="qc-mobile-menu-btn"
            onClick={onOpenMobileMenu}
            aria-label="Open menu"
          >
            <span aria-hidden>☰</span>
          </Button>
        ) : null}
        <div className="qc-brand-mark" aria-hidden="true">
          <span>≈</span>
        </div>
        <div>
          <h1 className="qc-sidebar-kicker">Quiet Current</h1>
          <p className="qc-sidebar-badge" title="Data stays on this device">
            Private · local-first
          </p>
        </div>
      </div>

      <nav className="qc-sidebar-nav" aria-label="Main">
        <ul className="qc-nav-list">
          {items.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                className={"qc-nav-item" + (activeTab === it.id ? " qc-nav-item--active" : "")}
                onClick={() => onSelect(it.id)}
                aria-current={activeTab === it.id ? "page" : undefined}
              >
                <span className="qc-nav-icon" aria-hidden="true">
                  {NAV_ICONS[it.id] || "·"}
                </span>
                <span>{it.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="qc-sidebar-footer">
        {statsOptIn ? (
          <div className="qc-sidebar-card qc-streak-card" aria-label="Visit streak">
            <p className="qc-streak-label">Daily rhythm</p>
            <p className="qc-streak-value">{streak}</p>
            <p className="qc-streak-hint">Days opened with tracking on.</p>
          </div>
        ) : (
          <div className="qc-sidebar-card qc-streak-card qc-streak-card--muted" aria-label="Streak">
            <p className="qc-streak-label">Daily rhythm</p>
            <p className="qc-streak-hint">Turn on visit tracking in Today to see a soft streak here.</p>
          </div>
        )}
        <div className="qc-local-pill" title="All content is stored on this device unless you choose otherwise">
          <span aria-hidden="true">●</span> Local only
        </div>
      </div>

      {profileName != null || onOpenSettings ? (
        <div className="qc-sidebar-profile qc-sidebar-profile--footer">
          <div className="qc-sidebar-profile-avatar" aria-hidden="true">
            {profileInitial(profileName ?? "You")}
          </div>
          <div className="qc-sidebar-profile-body">
            <p className="qc-sidebar-profile-name">{profileName ?? "You"}</p>
            {onOpenSettings ? (
              <button type="button" className="qc-sidebar-settings-link" onClick={() => onOpenSettings()}>
                Settings
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
