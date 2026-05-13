import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
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

const FEATURED_LINE = "A two-minute reset for when your mind is trying to solve everything.";

const CATEGORY_DEFS = [
  {
    id: "calm",
    label: "Calm",
    tags: ["calm", "anxiety", "seated"],
    categories: ["zen", "samatha", "insight"],
    note: "Settle the system",
  },
  {
    id: "focus",
    label: "Focus",
    tags: ["breath", "inquiry", "open"],
    categories: ["inquiry", "samatha", "mindfulness"],
    note: "Clear the next step",
  },
  {
    id: "joy",
    label: "Joy",
    tags: ["gratitude", "compassion"],
    categories: ["gratitude", "loving_kindness"],
    note: "Warmth and appreciation",
  },
  {
    id: "letting_go",
    label: "Letting go",
    tags: ["anxiety", "inquiry", "compassion"],
    categories: ["zen", "vipassana", "loving_kindness"],
    note: "Unhook gently",
  },
  {
    id: "sleep",
    label: "Sleep",
    tags: ["sleep", "body"],
    categories: ["vipassana", "gratitude"],
    note: "Downshift the evening",
  },
  {
    id: "self_compassion",
    label: "Self-compassion",
    tags: ["compassion", "anxiety"],
    categories: ["loving_kindness"],
    note: "Softer inner voice",
  },
  {
    id: "body_awareness",
    label: "Body awareness",
    tags: ["body", "walking"],
    categories: ["vipassana", "mindfulness"],
    note: "Return through sensation",
  },
  {
    id: "intention",
    label: "Gratitude / intention",
    tags: ["gratitude", "short"],
    categories: ["gratitude"],
    note: "Choose a direction",
  },
] as const;

function formatCategory(category: string) {
  return category.replace(/_/g, " ");
}

function visibleTags(p: Practice) {
  return (p.tags || []).slice(0, 4);
}

function categoryMatches(p: Practice, categoryId: string) {
  const def = CATEGORY_DEFS.find((c) => c.id === categoryId);
  if (!def) return true;
  const tags = p.tags || [];
  return def.categories.includes(p.category) || def.tags.some((t) => tags.includes(t));
}

function benefitFor(p: Practice) {
  const tags = p.tags || [];
  if (tags.includes("sleep")) return "Best for easing the day down.";
  if (tags.includes("breath")) return "Best for returning to one steady anchor.";
  if (tags.includes("body")) return "Best for getting out of the head and into sensation.";
  if (tags.includes("gratitude")) return "Best for noticing what is already supporting you.";
  if (tags.includes("inquiry")) return "Best for loosening a sticky thought loop.";
  if (tags.includes("anxiety")) return "Best for resetting after tension or scrolling.";
  return "Best for a short, practical reset.";
}

function byDuration(a: Practice, b: Practice) {
  return (a.est_minutes ?? 99) - (b.est_minutes ?? 99) || a.sort_order - b.sort_order;
}

function groupPracticesByCategory(items: Practice[]) {
  const groups = new Map<string, Practice[]>();
  for (const item of items) {
    const key = item.category || "general";
    const current = groups.get(key) || [];
    current.push(item);
    groups.set(key, current);
  }
  return Array.from(groups.entries()).map(([category, rows]) => ({ category, rows }));
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
  const [activeCategory, setActiveCategory] = useState("all");
  const [showAll, setShowAll] = useState(false);
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

  function applyFilter(nextTag: string, nextMaxMin: number | "") {
    setTag(nextTag);
    setMaxMin(nextMaxMin);
    setActiveCategory("all");
    setShowAll(false);
  }

  const shortPractices = practices.filter((p) => (p.est_minutes ?? 99) <= 10);
  const featured = shortPractices.find((p) => p.is_favorite) || shortPractices[0] || practices[0] || null;
  const savedPractices = practices.filter((p) => p.is_favorite).slice(0, 4);
  const quickStarts = useMemo(() => {
    const pool = practices.slice().sort(byDuration);
    const picks = [
      pool.find((p) => (p.est_minutes ?? 99) <= 2),
      pool.find((p) => (p.tags || []).includes("breath")),
      pool.find((p) => (p.tags || []).includes("sleep")),
      pool.find((p) => (p.tags || []).includes("gratitude")),
    ].filter((p): p is Practice => Boolean(p));
    return Array.from(new Map(picks.map((p) => [p.id, p])).values()).slice(0, 4);
  }, [practices]);
  const categoryCounts = useMemo(
    () =>
      CATEGORY_DEFS.map((c) => ({
        ...c,
        count: practices.filter((p) => categoryMatches(p, c.id)).length,
      })),
    [practices],
  );
  const visiblePractices = useMemo(() => {
    const filtered =
      activeCategory === "all" ? practices : practices.filter((p) => categoryMatches(p, activeCategory));
    return filtered.slice().sort((a, b) => a.sort_order - b.sort_order);
  }, [activeCategory, practices]);
  const libraryPreview = showAll ? visiblePractices : visiblePractices.slice(0, 6);
  const hasMoreLibrary = visiblePractices.length > libraryPreview.length;
  const groupedLibrary = showAll && activeCategory === "all" ? groupPracticesByCategory(visiblePractices) : [];
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
        subtitle="A curated library of two to ten minute resets for the moment you are actually in."
      />

      {featured ? (
        <section className="practice-now-hero practice-now-hero--featured" aria-labelledby="practice-now-title">
          <div className="practice-now-copy">
            <p className="practice-now-eyebrow">Featured practice</p>
            <h3 id="practice-now-title">{featured.title}</h3>
            <p className="practice-now-resonance">{FEATURED_LINE}</p>
            <p>{featured.summary}</p>
            <div className="practice-now-meta">
              <span>{featured.est_minutes ?? 2} min</span>
              <span>{formatCategory(featured.category)}</span>
              {visibleTags(featured)
                .slice(0, 2)
                .map((t) => (
                  <span key={t}>{t}</span>
                ))}
            </div>
            <p className="practice-now-benefit">{benefitFor(featured)}</p>
          </div>
          <div className="practice-now-art" aria-hidden="true" />
          <div className="practice-now-actions">
            <button type="button" className="btn btn-primary" onClick={() => setRun(featured)}>
              Start practice
            </button>
            <button type="button" className="btn practice-save-subtle" onClick={(e) => void toggleFavorite(featured, e)}>
              {featured.is_favorite ? "Saved" : "Save"}
            </button>
          </div>
        </section>
      ) : null}

      {!loading && !err && quickStarts.length > 0 ? (
        <section className="practice-section practice-quick-starts" aria-labelledby="practice-quick-starts-title">
          <div className="practice-section-head">
            <div>
              <p className="practice-section-kicker">Quick start</p>
              <h3 id="practice-quick-starts-title">Start with the smallest useful reset.</h3>
            </div>
          </div>
          <div className="practice-quick-row">
            {quickStarts.map((p) => (
              <button key={p.id} type="button" className="practice-quick-card" onClick={() => setRun(p)}>
                <span>{p.est_minutes ?? 2} min</span>
                <strong>{p.title}</strong>
                <small>{formatCategory(p.category)}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {!loading && !err && savedPractices.length > 0 ? (
        <section className="practice-section practice-saved-section" aria-labelledby="practice-saved-title">
          <div className="practice-section-head">
            <div>
              <p className="practice-section-kicker">Continue</p>
              <h3 id="practice-saved-title">Saved practices</h3>
            </div>
          </div>
          <div className="practice-saved-row">
            {savedPractices.map((p) => (
              <button key={p.id} type="button" className="practice-saved-pill" onClick={() => setRun(p)}>
                <span>{p.est_minutes ?? 2} min</span>
                {p.title}
              </button>
            ))}
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
                onClick={() => applyFilter(chip.tag, chip.maxMin)}
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
              <select className="pr-select" value={tag} onChange={(e) => applyFilter(e.target.value, maxMin)}>
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
                  applyFilter(tag, v === "" ? "" : Number(v));
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
            <button type="button" className="btn" onClick={() => applyFilter("", "")}>
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && !err && practices.length > 0 ? (
        <>
          <section className="practice-section practice-category-section" aria-labelledby="practice-categories-title">
            <div className="practice-section-head">
              <div>
                <p className="practice-section-kicker">Browse by need</p>
                <h3 id="practice-categories-title">Practice categories</h3>
              </div>
            </div>
            <div className="practice-category-rail" role="list" aria-label="Practice categories">
              <button
                type="button"
                className={"practice-category-card" + (activeCategory === "all" ? " practice-category-card--active" : "")}
                aria-pressed={activeCategory === "all"}
                onClick={() => {
                  setActiveCategory("all");
                  setShowAll(false);
                }}
              >
                <span>All</span>
                <small>Full library</small>
                <strong>{practices.length} practices</strong>
              </button>
              {categoryCounts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={"practice-category-card" + (activeCategory === c.id ? " practice-category-card--active" : "")}
                  aria-pressed={activeCategory === c.id}
                  onClick={() => {
                    setActiveCategory(c.id);
                    setShowAll(false);
                  }}
                >
                  <span>{c.label}</span>
                  <small>{c.note}</small>
                  <strong>{c.count} practices</strong>
                </button>
              ))}
            </div>
          </section>

          <section className="practice-section practice-library-section" aria-labelledby="practice-library-title">
            <div className="practice-section-head practice-section-head--inline">
              <div>
                <p className="practice-section-kicker">{showAll ? "Expanded library" : "Recommended for now"}</p>
                <h3 id="practice-library-title">
                  {activeCategory === "all"
                    ? "Short resets"
                    : CATEGORY_DEFS.find((c) => c.id === activeCategory)?.label || "Filtered practices"}
                </h3>
              </div>
              <p className="practice-library-count">
                Showing {libraryPreview.length} of {visiblePractices.length}
              </p>
            </div>

            {groupedLibrary.length > 0 ? (
              <div className="practice-library-groups">
                {groupedLibrary.map((group) => (
                  <section key={group.category} className="practice-library-group" aria-label={formatCategory(group.category)}>
                    <h4>{formatCategory(group.category)}</h4>
                    <div className="practice-grid">
                      {group.rows.map((p) => (
                        <PracticeCard
                          key={p.id}
                          practice={p}
                          suggested={featured?.id === p.id}
                          onStart={setRun}
                          onToggleFavorite={toggleFavorite}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="practice-grid">
                {libraryPreview.map((p) => (
                  <PracticeCard
                    key={p.id}
                    practice={p}
                    suggested={featured?.id === p.id}
                    onStart={setRun}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            )}

            {hasMoreLibrary || showAll ? (
              <div className="practice-show-more-row">
                <button type="button" className="btn practice-show-more" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Collapse library" : "Show all practices"}
                </button>
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {run && <PracticeRun practice={run} onClose={() => setRun(null)} />}
    </div>
  );
}

function PracticeCard({
  practice,
  suggested,
  onStart,
  onToggleFavorite,
}: {
  practice: Practice;
  suggested: boolean;
  onStart: (practice: Practice) => void;
  onToggleFavorite: (practice: Practice, event: MouseEvent) => void;
}) {
  return (
    <article
      className={"card practice-card practice-card--interactive" + (suggested ? " practice-card--suggested" : "")}
      tabIndex={0}
      aria-label={`Open practice: ${practice.title}`}
      onClick={() => onStart(practice)}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onStart(practice);
        }
      }}
    >
      <div className="practice-card-head">
        <div className="pill">{formatCategory(practice.category)}</div>
        <button
          type="button"
          className={"fav-btn" + (practice.is_favorite ? " on" : "")}
          onClick={(e) => onToggleFavorite(practice, e)}
          aria-pressed={practice.is_favorite}
          aria-label={practice.is_favorite ? "Remove from saved" : "Save practice"}
        />
      </div>
      <h3>{practice.title}</h3>
      <p className="practice-body">{benefitFor(practice)}</p>
      <p className="practice-card-summary">{practice.summary}</p>
      <div className="practice-card-actions" onClick={(e) => e.stopPropagation()}>
        <span className="practice-card-duration">{practice.est_minutes != null ? `${practice.est_minutes} min` : "Short reset"}</span>
        <button type="button" className="btn btn-primary practice-card-start" onClick={() => onStart(practice)}>
          Start
        </button>
      </div>
    </article>
  );
}
