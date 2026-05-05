import { useCallback, useEffect, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { Practice } from "../types";
import { PracticeRun } from "./PracticeRun";
import { PageHeader } from "./ui/PageHeader";

const TAG_OPTIONS = [
  { id: "", label: "All tags" },
  { id: "anxiety", label: "Anxiety" },
  { id: "body", label: "Body" },
  { id: "breath", label: "Breath" },
  { id: "gratitude", label: "Gratitude" },
  { id: "short", label: "Short" },
  { id: "sleep", label: "Sleep" },
  { id: "inquiry", label: "Inquiry" },
  { id: "beginner", label: "Beginner" },
];

const FILTER_CHIPS = [
  { id: "all", label: "All", tag: "", maxMin: "" as const },
  { id: "breath", label: "Breath", tag: "breath", maxMin: "" as const },
  { id: "body", label: "Body", tag: "body", maxMin: "" as const },
  { id: "gratitude", label: "Gratitude", tag: "gratitude", maxMin: "" as const },
  { id: "sleep", label: "Sleep", tag: "sleep", maxMin: "" as const },
  { id: "short", label: "Under 5 min", tag: "", maxMin: 5 },
];

function formatCategory(category: string) {
  return category.replace(/_/g, " ");
}

function visibleTags(p: Practice) {
  return (p.tags || []).slice(0, 4);
}

export function PracticesPanel({
  focusPracticeId,
  onFocusConsumed,
}: {
  focusPracticeId: number | null;
  onFocusConsumed: () => void;
}) {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tag, setTag] = useState("");
  const [maxMin, setMaxMin] = useState<number | "">("");
  const [run, setRun] = useState<Practice | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (tag) sp.set("tag", tag);
      if (maxMin !== "" && Number.isFinite(maxMin)) sp.set("maxMinutes", String(maxMin));
      const q = sp.toString();
      const r = await fetch("/api/practices" + (q ? "?" + q : ""));
      if (!r.ok) {
        setErr("Could not load practices.");
        setPractices([]);
      } else {
        setPractices((await r.json()) as Practice[]);
      }
    } catch {
      setErr("Could not load practices.");
      setPractices([]);
    } finally {
      setLoading(false);
    }
  }, [tag, maxMin]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (focusPracticeId == null) return;
    if (loading) return;
    const p = practices.find((x) => x.id === focusPracticeId);
    if (p) {
      setRun(p);
    }
    onFocusConsumed();
  }, [focusPracticeId, practices, loading, onFocusConsumed]);

  async function toggleFavorite(p: Practice, e: MouseEvent) {
    e.stopPropagation();
    const m = p.is_favorite ? "DELETE" : "POST";
    const r = await fetch("/api/practices/" + p.id + "/favorite", { method: m });
    if (r.ok) void load();
  }

  const shortPractices = practices.filter((p) => (p.est_minutes ?? 99) <= 10);
  const featured = shortPractices.find((p) => p.is_favorite) || shortPractices[0] || practices[0] || null;
  const hasActiveFilter = tag !== "" || maxMin !== "";
  const activeFilterLabel = tag
    ? TAG_OPTIONS.find((o) => o.id === tag)?.label || tag
    : maxMin !== ""
      ? `${maxMin} minutes or less`
      : "all practices";

  return (
    <div className="panel practices-library">
      <PageHeader
        title="Short practices"
        subtitle="Two to ten minute resets for the moment you are actually in: restless, tense, unfocused, grateful, or ready to sit."
      />

      {featured ? (
        <section className="practice-now-hero practice-now-hero--featured" aria-labelledby="practice-now-title">
          <div className="practice-now-copy">
            <p className="practice-now-eyebrow">Suggested for right now</p>
            <h3 id="practice-now-title">{featured.title}</h3>
            <p>{featured.summary}</p>
            <div className="practice-now-meta">
              <span>{featured.est_minutes ?? 2} min</span>
              <span>{formatCategory(featured.category)}</span>
              {visibleTags(featured).slice(0, 2).map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </div>
          <div className="practice-now-art" aria-hidden="true" />
          <div className="practice-now-actions">
            <button type="button" className="btn btn-primary" onClick={() => setRun(featured)}>
              Start practice
            </button>
            <button type="button" className="btn" onClick={(e) => void toggleFavorite(featured, e)}>
              {featured.is_favorite ? "Saved" : "Save"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="practices-filter-shell" aria-label="Practice filters">
        <div className="practice-filter-chips">
          <span className="practice-filter-label">Filter practices</span>
          {FILTER_CHIPS.map((chip) => {
            const active = chip.tag === tag && chip.maxMin === maxMin;
            return (
              <button
                key={chip.id}
                type="button"
                className={"practice-filter-chip" + (active ? " practice-filter-chip--active" : "")}
                aria-pressed={active}
                onClick={() => {
                  setTag(chip.tag);
                  setMaxMin(chip.maxMin);
                }}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
        <details className="practice-advanced-filters">
          <summary>More filters</summary>
          <div className="practices-toolbar">
        <label className="pr-filter">
          Tag
          <select className="pr-select" value={tag} onChange={(e) => setTag(e.target.value)}>
            {TAG_OPTIONS.map((o) => (
              <option key={o.id || "all"} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="pr-filter">
          Max minutes
          <select
            className="pr-select"
            value={maxMin === "" ? "" : String(maxMin)}
            onChange={(e) => {
              const v = e.target.value;
              setMaxMin(v === "" ? "" : Number(v));
            }}
          >
            <option value="">Any</option>
            <option value="5">{"<= 5"}</option>
            <option value="10">{"<= 10"}</option>
            <option value="15">{"<= 15"}</option>
          </select>
        </label>
          </div>
        </details>
      </section>

      {err && (
        <div className="practice-state-card practice-state-card--error" role="alert">
          <p className="practice-state-title">Practices could not load.</p>
          <p>Check the local server and try again when the app is back in rhythm.</p>
          <button type="button" className="btn" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}
      {loading && (
        <div className="practice-skeleton-grid" role="status" aria-busy="true" aria-label="Loading practices">
          {[0, 1, 2].map((i) => (
            <span key={i} className="practice-skeleton-card" />
          ))}
        </div>
      )}
      {!loading && !err && practices.length === 0 ? (
        <div className="practice-state-card practices-empty">
          <p className="practice-state-title">No practices match {activeFilterLabel.toLowerCase()}.</p>
          <p>Clear filters to return to the full library of short resets.</p>
          {hasActiveFilter ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setTag("");
                setMaxMin("");
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="practice-grid">
        {practices.map((p) => (
          <article
            key={p.id}
            className={
              "card practice-card practice-card--interactive" +
              (featured?.id === p.id ? " practice-card--suggested" : "")
            }
            tabIndex={0}
            aria-label={`Open practice: ${p.title}`}
            onClick={() => setRun(p)}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setRun(p);
              }
            }}
          >
            <div className="practice-card-head">
              <div className="pill">{formatCategory(p.category)}</div>
              <button
                type="button"
                className={"fav-btn" + (p.is_favorite ? " on" : "")}
                onClick={(e) => void toggleFavorite(p, e)}
                title={p.is_favorite ? "Unfavorite" : "Favorite"}
                aria-pressed={p.is_favorite}
                aria-label={p.is_favorite ? "Remove from saved" : "Save practice"}
              />
            </div>
            <h3>{p.title}</h3>
            <p className="practice-body">{p.summary}</p>
            <div className="practice-tags" aria-label="Tags">
              {visibleTags(p).map((t) => (
                <span key={t} className="pr-tag-pill">
                  {t}
                </span>
              ))}
              {p.est_minutes != null && (
                <span className="pr-tag-pill pr-min">~{p.est_minutes} min</span>
              )}
            </div>
            <div className="practice-card-actions" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="btn btn-primary" onClick={() => setRun(p)}>
                Start {p.est_minutes != null ? `${p.est_minutes} min` : "practice"}
              </button>
            </div>
          </article>
        ))}
      </div>

      {run && <PracticeRun practice={run} onClose={() => setRun(null)} />}
    </div>
  );
}
