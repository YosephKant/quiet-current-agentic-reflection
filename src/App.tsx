import { useCallback, useEffect, useState } from "react";
import { HomePanel } from "./components/HomePanel";
import { NotesPanel } from "./components/NotesPanel";
import { PracticesPanel } from "./components/PracticesPanel";
import { ChatPanel } from "./components/ChatPanel";
import { DailyHabitsPanel } from "./components/DailyHabitsPanel";
import { WeeklyReviewPanel } from "./components/WeeklyReviewPanel";
import { InsightsPanel } from "./components/InsightsPanel";
import { PrivacyPanel } from "./components/PrivacyPanel";
import { HoroscopePanel } from "./components/HoroscopePanel";
import { AmbiencePanel } from "./components/AmbiencePanel";
import { GuideBuilderHubPanel } from "./components/GuideBuilderHubPanel";
import { AppShell } from "./components/shell/AppShell";
import { SidebarNav, type NavItem } from "./components/shell/SidebarNav";
import { MobileDrawer } from "./components/shell/MobileDrawer";
import type { GuideBuilderSection, NoteKind, Tab } from "./types";
import { APP_AMBIENT_TAGLINE } from "./appTagline";

const VALID_TABS = new Set<Tab>([
  "home",
  "habits",
  "weekly",
  "insights",
  "guide_builder",
  "notes",
  "practices",
  "chat",
  "privacy",
  "horoscope",
  "ambience",
]);

const SIDEBAR_ITEMS: NavItem[] = [
  { id: "home", label: "Today" },
  { id: "practices", label: "Practice" },
  { id: "chat", label: "Guide" },
  { id: "notes", label: "Journal" },
  { id: "insights", label: "Insights" },
  { id: "weekly", label: "Weekly Review" },
  { id: "horoscope", label: "Horoscope" },
  { id: "ambience", label: "Ambience" },
  { id: "guide_builder", label: "Guide Builder" },
  { id: "habits", label: "Daily rhythm" },
  { id: "privacy", label: "Privacy" },
];

const MOBILE_BOTTOM: { id: Tab; label: string }[] = [
  { id: "home", label: "Today" },
  { id: "practices", label: "Practice" },
  { id: "chat", label: "Guide" },
  { id: "notes", label: "Journal" },
];

const MOBILE_MORE_IDS = new Set<Tab>(
  SIDEBAR_ITEMS.map((s) => s.id).filter((id) => !MOBILE_BOTTOM.some((b) => b.id === id))
);

const NOTE_KINDS = new Set<NoteKind>(["general", "gratitude", "reflection", "intention", "idea", "practice"]);

function parseLocation(): { tab: Tab; guideSection: GuideBuilderSection } {
  const fallback = { tab: "home" as const, guideSection: "teachers" as const };
  if (typeof window === "undefined") return fallback;
  const p = new URLSearchParams(window.location.search);
  const t = p.get("tab");
  const sec = p.get("section");

  if (t === "agents" || (t === "guide_builder" && sec === "agents")) {
    return { tab: "guide_builder", guideSection: "agents" };
  }
  if (t === "teachers" || (t === "guide_builder" && sec === "teachers")) {
    return { tab: "guide_builder", guideSection: "teachers" };
  }
  if (t === "guide_builder") {
    return { tab: "guide_builder", guideSection: sec === "agents" ? "agents" : "teachers" };
  }

  if (t && VALID_TABS.has(t as Tab)) {
    return { tab: t as Tab, guideSection: "teachers" };
  }
  return fallback;
}

function tabQueryValue(tab: Tab, guideSection: GuideBuilderSection): { tab: string; section?: string } {
  if (tab !== "guide_builder") return { tab };
  return { tab: "guide_builder", section: guideSection };
}

function readSidebarDisplayName(): string {
  if (typeof window === "undefined") return "friend";
  const raw = window.localStorage.getItem("qc_display_name");
  const t = (raw ?? "").trim();
  return t.length > 0 ? t : "friend";
}

export default function App() {
  const init = parseLocation();
  const [tab, setTab] = useState<Tab>(init.tab);
  const [guideSection, setGuideSection] = useState<GuideBuilderSection>(init.guideSection);
  const [focusChatSessionId, setFocusChatSessionId] = useState<number | null>(null);
  const [focusPracticeId, setFocusPracticeId] = useState<number | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [homeSnap, setHomeSnap] = useState<{ streak: number; statsOptIn: boolean }>({
    streak: 0,
    statsOptIn: false,
  });
  const [sidebarProfileName, setSidebarProfileName] = useState(readSidebarDisplayName);

  function selectTab(next: Tab) {
    setTab(next);
    setMobileDrawerOpen(false);
  }

  function openNotes(kind: NoteKind = "general") {
    const safeKind = NOTE_KINDS.has(kind) ? kind : "general";
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "notes");
      url.searchParams.set("kind", safeKind);
      url.searchParams.delete("section");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
    selectTab("notes");
  }

  function selectGuideSection(next: GuideBuilderSection) {
    setGuideSection(next);
  }

  useEffect(() => {
    const q = tabQueryValue(tab, guideSection);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", q.tab);
    if (q.section) url.searchParams.set("section", q.section);
    else url.searchParams.delete("section");
    if (tab !== "notes") url.searchParams.delete("kind");
    window.history.replaceState(null, "", url.pathname + url.search);
  }, [tab, guideSection]);

  useEffect(() => {
    function onPopState() {
      const next = parseLocation();
      setTab(next.tab);
      setGuideSection(next.guideSection);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const refreshSidebarSnap = useCallback(async () => {
    const r = await fetch("/api/home");
    if (!r.ok) return;
    const j = (await r.json()) as { streak?: number; statsOptIn?: boolean };
    setHomeSnap({ streak: Number(j.streak ?? 0), statsOptIn: !!j.statsOptIn });
  }, []);

  useEffect(() => {
    void refreshSidebarSnap();
  }, [refreshSidebarSnap]);

  useEffect(() => {
    if (tab !== "home") return;
    void refreshSidebarSnap();
  }, [tab, refreshSidebarSnap]);

  useEffect(() => {
    setSidebarProfileName(readSidebarDisplayName());
  }, [tab]);

  const sidebar = (
    <SidebarNav
      items={SIDEBAR_ITEMS}
      activeTab={tab}
      onSelect={selectTab}
      streak={homeSnap.streak}
      statsOptIn={homeSnap.statsOptIn}
      profileName={sidebarProfileName}
      onOpenSettings={() => selectTab("privacy")}
    />
  );

  const drawerNav = (
    <nav className="qc-drawer-nav" aria-label="More">
      <ul className="qc-nav-list qc-nav-list--drawer">
        {SIDEBAR_ITEMS.filter((it) => MOBILE_MORE_IDS.has(it.id)).map((it) => (
          <li key={it.id}>
            <button
              type="button"
              className={"qc-nav-item" + (tab === it.id ? " qc-nav-item--active" : "")}
              onClick={() => selectTab(it.id)}
              aria-current={tab === it.id ? "page" : undefined}
            >
              {it.label}
            </button>
          </li>
        ))}
      </ul>
      <div className="qc-drawer-meta">
        <p className="qc-sidebar-badge">Private · local-first · unhurried</p>
      </div>
    </nav>
  );

  const mobileNav = (
    <>
      <MobileDrawer open={mobileDrawerOpen} onClose={() => setMobileDrawerOpen(false)} title="More">
        {drawerNav}
      </MobileDrawer>
      <nav className="qc-bottom-nav" aria-label="Primary">
        {MOBILE_BOTTOM.map((b) => (
          <button
            key={b.id}
            type="button"
            className={"qc-bottom-nav-item" + (tab === b.id ? " qc-bottom-nav-item--active" : "")}
            onClick={() => selectTab(b.id)}
            aria-current={tab === b.id ? "page" : undefined}
          >
            {b.label}
          </button>
        ))}
        <button
          type="button"
          className={"qc-bottom-nav-item" + (MOBILE_MORE_IDS.has(tab) ? " qc-bottom-nav-item--active" : "")}
          onClick={() => setMobileDrawerOpen(true)}
          aria-expanded={mobileDrawerOpen}
        >
          More
        </button>
      </nav>
    </>
  );

  return (
    <AppShell sidebar={<div className="qc-sidebar-slot">{sidebar}</div>} mobileNav={mobileNav}>
      <div
        id="main-content"
        className={
          "qc-main-stage" +
          (tab === "chat" ? " qc-main-stage--guide-focus" : "") +
          (tab === "home" ? " qc-main-stage--home-focus" : "") +
          (tab === "notes" ? " qc-main-stage--journal-focus" : "")
        }
      >
        {tab !== "home" ? (
          <header className="qc-app-topbar">
            <div className="qc-app-topbar-inner">
              <p className="qc-app-tagline">{APP_AMBIENT_TAGLINE}</p>
            </div>
          </header>
        ) : null}

        <main className="qc-panel-stage-outer" role="main">
          <div key={tab + guideSection} className="panel-stage">
            {tab === "home" && (
              <HomePanel
                onOpenChat={(id) => {
                  if (typeof id === "number") setFocusChatSessionId(id);
                  selectTab("chat");
                }}
                onOpenPractices={(pid) => {
                  if (typeof pid === "number") setFocusPracticeId(pid);
                  selectTab("practices");
                }}
                onOpenNotes={openNotes}
                onOpenWeekly={() => selectTab("weekly")}
                onOpenInsights={() => selectTab("insights")}
              />
            )}
            {tab === "habits" && <DailyHabitsPanel />}
            {tab === "weekly" && <WeeklyReviewPanel />}
            {tab === "insights" && <InsightsPanel />}
            {tab === "guide_builder" && (
              <GuideBuilderHubPanel section={guideSection} onSectionChange={selectGuideSection} />
            )}
            {tab === "notes" && <NotesPanel />}
            {tab === "practices" && (
              <PracticesPanel
                focusPracticeId={focusPracticeId}
                onFocusConsumed={() => setFocusPracticeId(null)}
              />
            )}
            {tab === "chat" && (
              <ChatPanel
                focusSessionId={focusChatSessionId}
                onFocusSessionConsumed={() => setFocusChatSessionId(null)}
              />
            )}
            {tab === "privacy" && <PrivacyPanel />}
            {tab === "horoscope" && <HoroscopePanel />}
            {tab === "ambience" && <AmbiencePanel />}
          </div>
        </main>
      </div>
    </AppShell>
  );
}
