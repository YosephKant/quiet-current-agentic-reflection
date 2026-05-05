import { useMemo, useState } from "react";

type WeeklyStats = {
  noteCount: number;
  chatTurns: number;
};

type ReviewArtifact = {
  hero: string;
  stoodOut: string[];
  supported: string[];
  carryForward: string[];
  nextStep: string;
};

const DEFAULT_WEEK_START = new Date(2025, 4, 5);

const FALLBACK_ARTIFACT: ReviewArtifact = {
  hero:
    "This week was a gentle reminder of your resilience. You kept returning to steadiness in small, meaningful ways.",
  stoodOut: [
    "You made room for reflection instead of rushing past what you felt.",
    "Small moments of awareness became useful signals.",
    "You kept choosing presence even when the week felt uneven.",
  ],
  supported: [
    "Short sits and mindful pauses created space.",
    "Writing helped you name what was happening with more care.",
    "Simple local practices gave your attention somewhere steady to land.",
  ],
  carryForward: [
    "Continue leaning into the practices that help you settle.",
    "Give yourself permission to slow down before deciding what comes next.",
    "Small, consistent choices are creating real change.",
  ],
  nextStep: "Choose one 10-minute practice this week that supports your nervous system.",
};

function stripMarkdown(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\d+\)\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/^[-*]\s+/, "")
    .replace(/\*\*/g, "")
    .trim();
}

function isHeading(line: string, headings: string[]): boolean {
  const normalized = stripMarkdown(line).toLowerCase();
  return headings.some((heading) => normalized === heading || normalized.startsWith(`${heading}:`));
}

function collectSection(lines: string[], startHeadings: string[], stopHeadings: string[]): string[] {
  const start = lines.findIndex((line) => isHeading(line, startHeadings));
  if (start === -1) return [];
  const collected: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (isHeading(line, stopHeadings)) break;
    const clean = stripMarkdown(line);
    if (clean) collected.push(clean);
  }
  return collected;
}

function parseWeeklyReview(content: string | null): ReviewArtifact {
  if (!content) return FALLBACK_ARTIFACT;
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const heroLines = collectSection(lines, ["weekly review"], [
    "patterns i noticed",
    "what helped this week",
    "gentle plan for next week",
    "inspiring lines",
  ]);
  const stoodOut = collectSection(lines, ["patterns i noticed", "what stood out"], [
    "what helped this week",
    "what supported you",
    "gentle plan for next week",
    "what to carry forward",
    "inspiring lines",
  ]);
  const supported = collectSection(lines, ["what helped this week", "what supported you"], [
    "gentle plan for next week",
    "what to carry forward",
    "inspiring lines",
  ]);
  const carryForward = collectSection(lines, ["gentle plan for next week", "what to carry forward"], [
    "inspiring lines",
  ]);

  const hero =
    heroLines.join(" ").slice(0, 280).trim() ||
    lines.map(stripMarkdown).find((line) => line && !isHeading(line, ["weekly review"])) ||
    FALLBACK_ARTIFACT.hero;
  const plan = carryForward.filter(Boolean);

  return {
    hero,
    stoodOut: stoodOut.length ? stoodOut.slice(0, 4) : FALLBACK_ARTIFACT.stoodOut,
    supported: supported.length ? supported.slice(0, 4) : FALLBACK_ARTIFACT.supported,
    carryForward: plan.length ? plan.slice(0, 3) : FALLBACK_ARTIFACT.carryForward,
    nextStep: plan[0] || FALLBACK_ARTIFACT.nextStep,
  };
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatWeekRange(start: Date): string {
  const end = addDays(start, 6);
  const startLabel = start.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  const endLabel = end.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

function buildJournalBody(artifact: ReviewArtifact, weekRange: string, rawContent: string | null): string {
  if (rawContent) return rawContent;
  return [
    `Weekly Review - ${weekRange}`,
    "",
    artifact.hero,
    "",
    "What stood out",
    ...artifact.stoodOut.map((line) => `- ${line}`),
    "",
    "What supported you",
    ...artifact.supported.map((line) => `- ${line}`),
    "",
    "What to carry forward",
    ...artifact.carryForward.map((line) => `- ${line}`),
    "",
    "A small next step",
    artifact.nextStep,
  ].join("\n");
}

export function WeeklyReviewPanel() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [weekStart, setWeekStart] = useState(DEFAULT_WEEK_START);
  const [copied, setCopied] = useState(false);
  const [savedJournal, setSavedJournal] = useState(false);

  const weekRange = useMemo(() => formatWeekRange(weekStart), [weekStart]);
  const artifact = useMemo(() => parseWeeklyReview(content), [content]);
  const hasReview = Boolean(content);

  async function onGenerate() {
    setLoading(true);
    setErr(null);
    setHint(null);
    setCopied(false);
    setSavedJournal(false);
    try {
      const r = await fetch("/api/weekly-review/generate", { method: "POST" });
      const data = (await r.json().catch(() => ({}))) as {
        content?: string;
        stats?: WeeklyStats;
        fallback?: boolean;
      };
      if (!r.ok) {
        setErr("Could not generate weekly review.");
        return;
      }
      setContent(String(data.content || "").trim() || null);
      setStats(data.stats || null);
      if (data.fallback) {
        setHint("AI was unavailable, so Quiet Current prepared a local summary from your saved activity.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not generate weekly review.");
    } finally {
      setLoading(false);
    }
  }

  async function onCopy() {
    const body = buildJournalBody(artifact, weekRange, content);
    await navigator.clipboard.writeText(body);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  async function onSaveToJournal() {
    if (!hasReview) return;
    setErr(null);
    const body = buildJournalBody(artifact, weekRange, content);
    const r = await fetch("/api/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `Weekly Review - ${weekRange}`,
        body,
        noteType: "reflection",
      }),
    });
    if (!r.ok) {
      setErr("Could not save this review to your journal.");
      return;
    }
    setSavedJournal(true);
    window.setTimeout(() => setSavedJournal(false), 2400);
  }

  return (
    <div className="panel weekly-review-artifact">
      <div className="weekly-review-shell">
        <header className="weekly-review-hero">
          <div className="weekly-review-heading">
            <h2>Weekly Review</h2>
            <p>A quiet look back before moving forward.</p>
          </div>
          <button
            type="button"
            className="weekly-generate-cta"
            onClick={() => void onGenerate()}
            disabled={loading}
          >
            <span className="weekly-cta-mark" aria-hidden />
            {loading ? "Generating..." : "Generate review"}
          </button>
        </header>

        <div className="weekly-review-toolbar" aria-label="Week selector">
          <button
            type="button"
            className="weekly-week-button"
            aria-label="Previous week"
            onClick={() => setWeekStart((current) => addDays(current, -7))}
          >
            <span aria-hidden>‹</span>
          </button>
          <div className="weekly-week-current">
            <span className="weekly-calendar-mark" aria-hidden />
            {weekRange}
          </div>
          <button
            type="button"
            className="weekly-week-button"
            aria-label="Next week"
            onClick={() => setWeekStart((current) => addDays(current, 7))}
          >
            <span aria-hidden>›</span>
          </button>
          <span className="weekly-local-pill">
            <span className="weekly-lock-mark" aria-hidden />
            Local summary
          </span>
        </div>

        {hint ? <p className="weekly-review-notice">{hint}</p> : null}
        {err ? <p className="weekly-review-error">{err}</p> : null}

        <article className={`weekly-editorial-card${hasReview ? "" : " weekly-editorial-card--empty"}`}>
          {hasReview ? (
            <>
              <section className="weekly-reflection-block">
                <p className="weekly-eyebrow">Your week in reflection</p>
                <h3>{artifact.hero}</h3>
              </section>

              <WeeklyLeafDivider />

              <WeeklySection icon="eye" title="What stood out" items={artifact.stoodOut} />
              <WeeklyLeafDivider />
              <WeeklySection icon="heart" title="What supported you" items={artifact.supported} />
              <WeeklyLeafDivider />
              <WeeklySection icon="leaf" title="What to carry forward" items={artifact.carryForward} prose />

              <section className="weekly-next-step">
                <span className="weekly-next-icon" aria-hidden />
                <div>
                  <h4>A small next step</h4>
                  <p>{artifact.nextStep}</p>
                  <p>Put it on your calendar and treat it like an appointment with you.</p>
                </div>
              </section>

              <footer className="weekly-card-footer">
                <button type="button" className="weekly-secondary-action" onClick={() => void onSaveToJournal()}>
                  <span className="weekly-bookmark-mark" aria-hidden />
                  {savedJournal ? "Saved to journal" : "Save to journal"}
                </button>
                <button type="button" className="weekly-secondary-action" onClick={() => void onCopy()}>
                  <span className="weekly-copy-mark" aria-hidden />
                  {copied ? "Copied" : "Copy to clipboard"}
                </button>
                <p>
                  <span className="weekly-shield-mark" aria-hidden />
                  Your review is private and stored only on this device.
                </p>
              </footer>
            </>
          ) : (
            <section className="weekly-empty-state">
              <div className="weekly-empty-illustration" aria-hidden>
                <span />
              </div>
              <div>
                <h3>Not enough local activity yet</h3>
                <p>Your review is generated from your local data.</p>
                <p>Come back after adding more:</p>
                <div className="weekly-empty-chips" aria-label="Activity types">
                  <span>Notes</span>
                  <span>Practices</span>
                  <span>Intentions</span>
                </div>
              </div>
            </section>
          )}
        </article>

        {stats ? (
          <p className="weekly-review-stats">
            Built from {stats.noteCount} notes and {stats.chatTurns} guide turns stored locally.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function WeeklyLeafDivider() {
  return (
    <div className="weekly-leaf-divider" aria-hidden>
      <img src="/textures/weekly-review/leaf-divider.png" alt="" />
    </div>
  );
}

function WeeklySection({
  icon,
  title,
  items,
  prose = false,
}: {
  icon: "eye" | "heart" | "leaf";
  title: string;
  items: string[];
  prose?: boolean;
}) {
  return (
    <section className="weekly-review-section">
      <span className={`weekly-section-icon weekly-section-icon--${icon}`} aria-hidden />
      <div>
        <h4>{title}</h4>
        {prose ? (
          <div className="weekly-section-prose">
            {items.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
