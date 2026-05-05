import { useState } from "react";
import { PageHeader } from "./ui/PageHeader";

type InsightStats = {
  noteCount: number;
  turnCount: number;
};

type InsightMetrics = {
  days: { ymd: string; label: string; notes: number; chats: number; total: number }[];
  topKeywords: { word: string; count: number }[];
  emotionalBalance: { grounded: number; activated: number };
  totalCaptures: number;
  activeDays: number;
  consistencyScore: number;
};

export function InsightsPanel() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [stats, setStats] = useState<InsightStats | null>(null);
  const [metrics, setMetrics] = useState<InsightMetrics | null>(null);

  async function onGenerate() {
    setLoading(true);
    setErr(null);
    setHint(null);
    try {
      const r = await fetch("/api/insights/generate", { method: "POST" });
      const data = (await r.json().catch(() => ({}))) as {
        content?: string;
        stats?: InsightStats;
        metrics?: InsightMetrics;
        fallback?: boolean;
      };
      if (!r.ok) {
        setErr("Could not generate insights.");
        return;
      }
      setContent(String(data.content || "").trim() || null);
      setStats(data.stats || null);
      setMetrics(data.metrics || null);
      if (data.fallback) setHint("AI unavailable; showing local fallback insights.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not generate insights.");
    } finally {
      setLoading(false);
    }
  }

  const maxDaily = Math.max(1, ...(metrics?.days || []).map((d) => d.total));
  const grounded = metrics?.emotionalBalance?.grounded ?? 0;
  const activated = metrics?.emotionalBalance?.activated ?? 0;
  const totalEmotional = Math.max(1, grounded + activated);
  const groundedPct = Math.round((grounded / totalEmotional) * 100);

  return (
    <div className="panel insights-panel qc-insights-layout">
      <PageHeader
        title="Insights"
        subtitle="A quiet read on your local notes and chats—charts first, with an optional AI reflection when you want it."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => void onGenerate()} disabled={loading}>
            {loading ? "Generating…" : "Generate insights"}
          </button>
        }
      />
      {stats ? (
        <div className="weekly-toolbar qc-insights-toolbar">
          <p className="home-meta">
            {stats.noteCount} notes · {stats.turnCount} chat turns analyzed
          </p>
        </div>
      ) : null}
      {hint && <p className="hint">{hint}</p>}
      {err && <p className="err">{err}</p>}

      {metrics ? (
        <div className="insights-grid">
          <section className="insight-card insight-card--kpi insight-chart-shell">
            <h3>Momentum</h3>
            <div className="insight-kpis">
              <div>
                <p className="insight-kpi-num">{metrics.totalCaptures}</p>
                <p className="home-meta">captures (7d)</p>
              </div>
              <div>
                <p className="insight-kpi-num">{metrics.activeDays}/7</p>
                <p className="home-meta">active days</p>
              </div>
              <div>
                <p className="insight-kpi-num">{metrics.consistencyScore}%</p>
                <p className="home-meta">consistency</p>
              </div>
            </div>
          </section>

          <section className="insight-card insight-chart-shell">
            <h3>Weekly pulse</h3>
            <div className="insight-bars" aria-label="Weekly activity bars">
              {metrics.days.map((d) => {
                const h = Math.round((d.total / maxDaily) * 100);
                return (
                  <div key={d.ymd} className="insight-bar-col">
                    <div className="insight-bar-wrap">
                      <div className="insight-bar" style={{ height: `${Math.max(6, h)}%` }} title={`${d.total} captures`} />
                    </div>
                    <span className="insight-bar-label">{d.label}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="insight-card insight-chart-shell">
            <h3>Emotional weather</h3>
            <div
              className="insight-dial"
              style={{
                background: `conic-gradient(#3d5a4a 0 ${groundedPct}%, #c9826b ${groundedPct}% 100%)`,
              }}
              aria-label="Grounded versus activated ratio"
            >
              <div className="insight-dial-inner">
                <p className="insight-kpi-num">{groundedPct}%</p>
                <p className="home-meta">grounded</p>
              </div>
            </div>
            <p className="home-meta">
              grounded: {grounded} · activated: {activated}
            </p>
          </section>

          <section className="insight-card insight-card--tags insight-chart-shell">
            <h3>Theme signals</h3>
            {metrics.topKeywords.length > 0 ? (
              <div className="insight-tags">
                {metrics.topKeywords.map((k) => (
                  <span key={k.word} className="insight-tag" style={{ fontSize: `${0.76 + Math.min(0.35, k.count * 0.03)}rem` }}>
                    {k.word} · {k.count}
                  </span>
                ))}
              </div>
            ) : (
              <p className="empty-state">No repeated signal words yet.</p>
            )}
          </section>
        </div>
      ) : null}

      {content ? <pre className="weekly-output insight-output">{content}</pre> : null}
      {!content && !loading && !err ? (
        <p className="empty-state">Generate insights whenever you want a fresh perspective.</p>
      ) : null}
    </div>
  );
}

