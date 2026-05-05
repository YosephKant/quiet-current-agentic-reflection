import { useCallback, useEffect, useState } from "react";
import type { HomeSnapshot, NoteKind } from "../types";
import "../styles/home-premium.css";
import { HomeHero } from "./home/HomeHero";
import { ContinueThreadCard } from "./home/ContinueThreadCard";
import { SuggestedPracticeFeature } from "./home/SuggestedPracticeFeature";
import { ReflectionInputSurface } from "./home/ReflectionInputSurface";
import { ReflectionSurface } from "./home/ReflectionSurface";
import { APP_AMBIENT_TAGLINE } from "../appTagline";

const COMFORT_LS = "qc_comfort_dim";

function readComfortDim(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(COMFORT_LS) === "1";
}

function greetingLine(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function readDisplayName(): string {
  if (typeof window === "undefined") return "friend";
  const raw = localStorage.getItem("qc_display_name");
  const t = (raw ?? "").trim();
  return t.length > 0 ? t : "friend";
}

export function HomePanel({
  onOpenChat,
  onOpenPractices,
  onOpenNotes,
  onOpenWeekly,
  onOpenInsights,
}: {
  onOpenChat: (sessionId?: number) => void;
  onOpenPractices: (practiceId?: number) => void;
  onOpenNotes: (kind?: NoteKind) => void;
  onOpenWeekly: () => void;
  onOpenInsights: () => void;
}) {
  const [data, setData] = useState<HomeSnapshot | null>(null);
  const [intention, setIntention] = useState("");
  const [statsOptIn, setStatsOptIn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reflection, setReflection] = useState<string | null>(null);
  const [reflecting, setReflecting] = useState(false);
  const [reflectionMeta, setReflectionMeta] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(readDisplayName);
  const [comfortDim, setComfortDim] = useState(readComfortDim);

  useEffect(() => {
    setDisplayName(readDisplayName());
  }, []);

  const toggleComfortDim = useCallback(() => {
    setComfortDim((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(COMFORT_LS, next ? "1" : "0");
      }
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setErr(null);
    setHint(null);
    const r = await fetch("/api/home");
    if (!r.ok) {
      setData({
        intention: "",
        statsOptIn: false,
        streak: 0,
        lastNote: null,
        lastSession: null,
        suggestedPractice: null,
        gratitudeCount: 0,
      });
      setIntention("");
      setStatsOptIn(false);
      setErr(null);
      setHint(
        "Could not load the live dashboard. If the API is not running, start it with npm run dev."
      );
      return;
    }
    const j = (await r.json()) as HomeSnapshot;
    setData(j);
    setIntention(j.intention);
    setStatsOptIn(j.statsOptIn);
  }, []);

  useEffect(() => {
    void (async () => {
      await fetch("/api/activity/visit", { method: "POST" });
      await load();
    })();
  }, [load]);

  async function savePrefs() {
    setSaving(true);
    setErr(null);
    const r = await fetch("/api/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ intention, statsOptIn }),
    });
    setSaving(false);
    if (!r.ok) {
      setErr("Could not save preferences.");
      return;
    }
    if (statsOptIn) {
      await fetch("/api/activity/visit", { method: "POST" });
    }
    await load();
  }

  async function generateReflection() {
    setReflecting(true);
    setErr(null);
    setHint(null);
    try {
      const r = await fetch("/api/chat/reflection/generate", { method: "POST" });
      const payload = (await r.json().catch(() => ({}))) as {
        content?: string;
        stats?: { totalMessages?: number; totalSessions?: number };
      };
      if (!r.ok) {
        setErr("Could not generate reflection right now.");
        return;
      }
      const totalMessages = Number(payload.stats?.totalMessages || 0);
      const totalSessions = Number(payload.stats?.totalSessions || 0);
      setReflectionMeta(`${totalSessions} sessions · ${totalMessages} messages considered`);
      setReflection(String(payload.content || "").trim() || null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not generate reflection right now.");
    } finally {
      setReflecting(false);
    }
  }

  const suggested = data?.suggestedPractice;
  const greetingTitle = `${greetingLine()}, ${displayName}`;
  const suggestedPreview =
    suggested != null
      ? { id: suggested.id, title: suggested.title, summary: suggested.summary }
      : null;

  return (
    <div className="panel home-panel qc-home">
      <div className="qc-home-page">
        <section
          className={"qc-home-canvas qc-home-premium qc-home-shell" + (comfortDim ? " qc-home-shell--comfort-dim" : "")}
          aria-label="Home dashboard"
        >
          {err ? <p className="err">{err}</p> : null}
          {hint ? <p className="hint">{hint}</p> : null}

          <HomeHero
            greetingTitle={greetingTitle}
            ambientTagline={APP_AMBIENT_TAGLINE}
            subtitle="A calm space for honest notetaking, short practices, and reflection that never leaves your device."
            onOpenNotes={() => onOpenNotes("general")}
            onOpenChat={() => onOpenChat()}
            onOpenWeekly={onOpenWeekly}
            onStartReset={() => onOpenPractices(suggested?.id)}
            comfortDim={comfortDim}
            onComfortToggle={toggleComfortDim}
          />

          <ContinueThreadCard
            sessionTitle={data?.lastSession != null ? (data.lastSession.title ?? "") : null}
            sessionId={data?.lastSession?.id ?? null}
            onResume={(sessionId) => {
              if (typeof sessionId === "number") onOpenChat(sessionId);
              else onOpenChat();
            }}
          />

          <div className="qc-home-editorial-grid">
            <div className="qc-home-editorial-slot qc-home-editorial-slot--waterfall">
              <ReflectionSurface
                layout="anchor"
                anchorShowDeeperLink={false}
                lastNote={data?.lastNote ?? null}
                streak={data?.streak ?? 0}
                statsOptIn={Boolean(data?.statsOptIn)}
                onReflect={() => void generateReflection()}
                reflecting={reflecting}
                reflection={reflection}
                reflectionMeta={reflectionMeta}
                onOpenInsights={onOpenInsights}
              />
            </div>
            <div className="qc-home-editorial-slot qc-home-editorial-slot--practice">
              <SuggestedPracticeFeature
                suggested={suggestedPreview}
                onStart={onOpenPractices}
              />
            </div>
            <div className="qc-home-editorial-slot qc-home-editorial-slot--intention">
              <ReflectionInputSurface
                segment="intention"
                className="qc-reflection-input-surface--home-intention"
                intention={intention}
                onChangeIntention={setIntention}
                statsOptIn={statsOptIn}
                onToggleOptIn={setStatsOptIn}
                saving={saving}
                onSave={() => void savePrefs()}
                intentionId="intention"
                onPickTemplate={(kind) => onOpenNotes(kind)}
              />
            </div>
            <div className="qc-home-editorial-slot qc-home-editorial-slot--starters">
              <ReflectionInputSurface
                segment="starters"
                className="qc-reflection-input-surface--home-starters"
                intention={intention}
                onChangeIntention={setIntention}
                statsOptIn={statsOptIn}
                onToggleOptIn={setStatsOptIn}
                saving={saving}
                onSave={() => void savePrefs()}
                intentionId="intention"
                onPickTemplate={(kind) => onOpenNotes(kind)}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
