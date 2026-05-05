import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Note, NoteKind } from "../types";
import "./notes/NotesJournal.css";

type KindFilter = "all" | NoteKind;

type KindMeta = {
  label: string;
  plural: string;
  shortLabel: string;
  prompt: string;
  placeholder: string;
  title: string;
  empty: string;
};

const KIND_ORDER: NoteKind[] = ["general", "gratitude", "reflection", "intention", "idea", "practice"];
const QUICK_KINDS: NoteKind[] = ["general", "gratitude", "reflection", "intention", "idea"];

const KIND_META: Record<NoteKind, KindMeta> = {
  general: {
    label: "General note",
    plural: "Notes",
    shortLabel: "Note",
    prompt: "Capture the sentence before it disappears.",
    placeholder: "Start with one honest sentence...",
    title: "New note",
    empty: "One honest sentence is enough.",
  },
  gratitude: {
    label: "Gratitude",
    plural: "Gratitude",
    shortLabel: "Gratitude",
    prompt: "What felt quietly good today?",
    placeholder: "I am grateful for...",
    title: "Gratitude",
    empty: "Start with one thing that softened the day.",
  },
  reflection: {
    label: "Reflection",
    plural: "Reflections",
    shortLabel: "Reflection",
    prompt: "What did you notice about yourself?",
    placeholder: "Today I noticed...",
    title: "Reflection",
    empty: "A small noticing can become a useful mirror.",
  },
  intention: {
    label: "Intention",
    plural: "Intentions",
    shortLabel: "Intention",
    prompt: "How do you want to meet the next hour?",
    placeholder: "For the next hour, I want to...",
    title: "Intention",
    empty: "Begin with how you want to arrive.",
  },
  idea: {
    label: "Idea",
    plural: "Ideas",
    shortLabel: "Idea",
    prompt: "What thought wants a little more room?",
    placeholder: "There is something here about...",
    title: "Idea",
    empty: "Catch the thought while it still has a pulse.",
  },
  practice: {
    label: "Practice note",
    plural: "Practice notes",
    shortLabel: "Practice",
    prompt: "What changed after practice?",
    placeholder: "After practice, I noticed...",
    title: "Practice note",
    empty: "Let the afterglow have one line.",
  },
};

function isNoteKind(value: unknown): value is NoteKind {
  return typeof value === "string" && KIND_ORDER.includes(value as NoteKind);
}

function noteKind(note: Note): NoteKind {
  return isNoteKind(note.note_type) ? note.note_type : "general";
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function previewText(note: Note) {
  const text = String(note.body || "").replace(/\s+/g, " ").trim();
  if (text) return text.slice(0, 118);
  return KIND_META[noteKind(note)].prompt;
}

function countWords(s: string) {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

function readKindFromUrl(): NoteKind | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("kind");
  return isNoteKind(raw) ? raw : null;
}

function setKindInUrl(kind: NoteKind) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("tab", "notes");
  url.searchParams.set("kind", kind);
  window.history.replaceState(null, "", url.pathname + url.search);
}

function NoteTypePill({ kind, compact = false }: { kind: NoteKind; compact?: boolean }) {
  return (
    <span className={`jn-type-pill jn-type-pill--${kind}`}>
      <span className="jn-type-dot" aria-hidden />
      {compact ? KIND_META[kind].shortLabel : KIND_META[kind].label}
    </span>
  );
}

export function NotesPanel() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isDraft, setIsDraft] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [noteType, setNoteType] = useState<NoteKind>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const titleRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search), 220);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setErr(null);
    const q = searchDebounced.trim();
    const url = q ? "/api/notes?" + new URLSearchParams({ q }) : "/api/notes";
    const r = await fetch(url);
    if (!r.ok) {
      setErr("Could not load notes.");
      return;
    }
    setNotes((await r.json()) as Note[]);
  }, [searchDebounced]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const selected = notes.find((note) => note.id === selectedId) ?? null;

  const filteredNotes = useMemo(() => {
    if (kindFilter === "all") return notes;
    return notes.filter((note) => noteKind(note) === kindFilter);
  }, [notes, kindFilter]);

  const noteCounts = useMemo(() => {
    const counts = new Map<KindFilter, number>([["all", notes.length]]);
    for (const kind of KIND_ORDER) counts.set(kind, 0);
    for (const note of notes) counts.set(noteKind(note), (counts.get(noteKind(note)) ?? 0) + 1);
    return counts;
  }, [notes]);

  const activeMeta = KIND_META[noteType];
  const hasEditor = isDraft || selected != null;
  const wordCount = useMemo(() => countWords(body), [body]);
  const selectedUpdatedAt = selected ? formatDate(selected.updated_at) : null;

  const beginDraft = useCallback((kind: NoteKind) => {
    setErr(null);
    setSavedHint(null);
    setSelectedId(null);
    setIsDraft(true);
    setNoteType(kind);
    setTitle(KIND_META[kind].title);
    setBody("");
    setKindFilter(kind);
    setKindInUrl(kind);
  }, []);

  useEffect(() => {
    const kind = readKindFromUrl();
    if (kind) beginDraft(kind);
  }, [beginDraft]);

  useEffect(() => {
    function onPopState() {
      const kind = readKindFromUrl();
      if (kind) beginDraft(kind);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [beginDraft]);

  useEffect(() => {
    if (!selected) return;
    setIsDraft(false);
    setTitle(selected.title);
    setBody(selected.body);
    setNoteType(noteKind(selected));
    setSavedHint(null);
  }, [selected?.id, selected?.title, selected?.body, selected?.note_type]);

  function selectExisting(note: Note) {
    setSelectedId(note.id);
    setIsDraft(false);
    setKindInUrl(noteKind(note));
  }

  function changeNoteType(kind: NoteKind) {
    setNoteType(kind);
    setKindInUrl(kind);
  }

  function applyTemplate(kind: NoteKind) {
    changeNoteType(kind);
    setTitle((current) => current.trim() || KIND_META[kind].title);
    setBody((current) => current || "");
    setSavedHint(null);
  }

  function onRenameNow() {
    titleRef.current?.focus();
    titleRef.current?.select();
  }

  async function onSave() {
    if (!hasEditor) return;
    setErr(null);
    setSavedHint(null);
    setSaving(true);
    const payload = JSON.stringify({ title, body, noteType });
    const r = await fetch(selectedId == null ? "/api/notes" : "/api/notes/" + selectedId, {
      method: selectedId == null ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: payload,
    });
    setSaving(false);
    if (!r.ok) {
      setErr("Could not save note.");
      return;
    }
    const saved = (await r.json()) as Note;
    setNotes((prev) => {
      const without = prev.filter((note) => note.id !== saved.id);
      return [saved, ...without].sort((a, b) => {
        const byDate = String(b.updated_at).localeCompare(String(a.updated_at));
        return byDate !== 0 ? byDate : b.id - a.id;
      });
    });
    setSelectedId(saved.id);
    setIsDraft(false);
    setSavedHint("Saved locally");
    window.setTimeout(() => setSavedHint(null), 2400);
    void load();
  }

  async function onDelete() {
    if (selectedId == null) return;
    if (!window.confirm("Delete this note?")) return;
    setErr(null);
    setSaving(true);
    const r = await fetch("/api/notes/" + selectedId, { method: "DELETE" });
    setSaving(false);
    if (!r.ok) {
      setErr("Could not delete note.");
      return;
    }
    setNotes((prev) => prev.filter((note) => note.id !== selectedId));
    setSelectedId(null);
    setIsDraft(false);
    setTitle("");
    setBody("");
    setNoteType("general");
    await load();
  }

  const filteredEmptyTitle =
    kindFilter === "all" ? "Nothing written yet." : `No ${KIND_META[kindFilter].plural.toLowerCase()} yet.`;
  const filteredEmptyCopy =
    kindFilter === "all" ? "One honest sentence is enough." : KIND_META[kindFilter].empty;

  return (
    <div className={`panel journal-panel jn-root${hasEditor ? " jn-root--editing" : ""}`}>
      <div className="jn-atmosphere" aria-hidden />

      <header className="jn-header">
        <div className="jn-header-copy">
          <p className="jn-eyebrow">Private journal</p>
          <h2 className="jn-title">Journal</h2>
          <p className="jn-subtitle">
            Capture one honest sentence, a gratitude, a reflection, an intention, or a small signal.
          </p>
        </div>
        <div className="jn-quick-actions" aria-label="Start a journal entry">
          {QUICK_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              className={`jn-quick jn-quick--${kind}`}
              data-testid={`jn-new-${kind}`}
              onClick={() => beginDraft(kind)}
            >
              <span className="jn-quick-mark" aria-hidden />
              {KIND_META[kind].shortLabel}
            </button>
          ))}
        </div>
      </header>

      {err ? (
        <p className="jn-err" role="alert">
          {err}
        </p>
      ) : null}

      <div className="jn-layout">
        <section className="jn-library" aria-labelledby="jn-list-heading">
          <div className="jn-library-head">
            <div>
              <p id="jn-list-heading" className="jn-section-kicker">
                Library
              </p>
              <p className="jn-library-count">{notes.length} local entries</p>
            </div>
            <button type="button" className="jn-icon-action" onClick={() => beginDraft("general")} aria-label="New note">
              +
            </button>
          </div>

          <label htmlFor="jn-search-input" className="sr-only">
            Search notes
          </label>
          <input
            id="jn-search-input"
            type="search"
            data-testid="jn-search"
            placeholder="Search title or body"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="jn-search-input"
          />

          <div className="jn-filter-row" role="group" aria-label="Filter by kind">
            {(["all", ...KIND_ORDER] as KindFilter[]).map((kind) => (
              <button
                key={kind}
                type="button"
                className="jn-filter-chip"
                data-testid={kind === "all" ? "jn-filter-all" : `jn-filter-${kind}`}
                aria-pressed={kindFilter === kind}
                onClick={() => setKindFilter(kind)}
              >
                {kind === "all" ? "All" : KIND_META[kind].plural}
                <span>{noteCounts.get(kind) ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="jn-note-list" role="list" aria-label="Saved notes">
            {loading ? <p className="jn-soft-state">Loading...</p> : null}
            {!loading && filteredNotes.length === 0 ? (
              <div className="jn-empty-card">
                <p className="jn-empty-title">{filteredEmptyTitle}</p>
                <p>{filteredEmptyCopy}</p>
                <div className="jn-empty-actions">
                  <button type="button" className="jn-btn-primary" onClick={() => beginDraft("general")}>
                    Write a note
                  </button>
                  <button type="button" className="jn-btn-secondary" onClick={() => beginDraft("gratitude")}>
                    Capture gratitude
                  </button>
                </div>
              </div>
            ) : null}
            {filteredNotes.map((note, index) => {
              const kind = noteKind(note);
              return (
                <button
                  type="button"
                  key={note.id}
                  role="listitem"
                  data-testid={index === 0 ? "jn-first-note-row" : undefined}
                  className={`jn-note-row${selectedId === note.id ? " jn-note-row--selected" : ""}`}
                  onClick={() => selectExisting(note)}
                >
                  <span className="jn-note-row-top">
                    <span className="jn-note-title">{note.title || "(Untitled)"}</span>
                    <NoteTypePill kind={kind} compact />
                  </span>
                  <span className="jn-note-preview">{previewText(note)}</span>
                  <span className="jn-note-meta">{formatDate(note.updated_at)}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="jn-editor-region" aria-label="Journal editor">
          {!hasEditor ? (
            <div className="jn-editor-empty">
              <p className="jn-section-kicker">Begin</p>
              <h3>Choose a note, or begin with one small sentence.</h3>
              <p>Nothing is sent anywhere. Your journal stays local to this device.</p>
              <div className="jn-empty-actions">
                <button type="button" className="jn-btn-primary" onClick={() => beginDraft("general")}>
                  New note
                </button>
                <button type="button" className="jn-btn-secondary" onClick={() => beginDraft("reflection")}>
                  Start reflection
                </button>
              </div>
            </div>
          ) : (
            <article className={`jn-editor-card jn-editor-card--${noteType}`}>
              <div className="jn-editor-card-bg" aria-hidden />
              <div className="jn-editor-top">
                <div>
                  <NoteTypePill kind={noteType} />
                  <p className="jn-editor-prompt">{activeMeta.prompt}</p>
                </div>
                <div className="jn-editor-status">
                  {savedHint ?? (isDraft ? "Draft, not saved yet" : "Saved locally")}
                </div>
              </div>

              <div className="jn-kind-selector" aria-label="Entry type">
                {KIND_ORDER.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className={`jn-kind-option jn-kind-option--${kind}`}
                    aria-pressed={noteType === kind}
                    onClick={() => applyTemplate(kind)}
                  >
                    {KIND_META[kind].shortLabel}
                  </button>
                ))}
              </div>

              <label htmlFor="note-title" className="sr-only">
                Title
              </label>
              <input
                id="note-title"
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="jn-title-input"
                placeholder={activeMeta.title}
                autoComplete="off"
              />

              {selected?.title_auto ? (
                <div className="jn-auto-row">
                  <span>Title generated</span>
                  <button type="button" className="jn-inline-btn" onClick={onRenameNow}>
                    Rename
                  </button>
                </div>
              ) : null}

              {selected?.source_session_id != null ? (
                <p className="jn-source-note">Saved from Guide session {selected.source_session_id}</p>
              ) : null}

              <label htmlFor="note-body" className="sr-only">
                Content
              </label>
              <textarea
                id="note-body"
                ref={bodyRef}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setSavedHint(null);
                }}
                className="jn-body-input"
                placeholder={activeMeta.placeholder}
              />

              <footer className="jn-editor-footer">
                <div className="jn-writing-stats" aria-label="Writing statistics">
                  <span>{wordCount} words</span>
                  <span>{body.length} characters</span>
                  {selectedUpdatedAt ? <span>Updated {selectedUpdatedAt}</span> : <span>New local draft</span>}
                </div>
                <div className="jn-editor-actions">
                  {selectedId != null ? (
                    <button type="button" className="jn-btn-danger" onClick={onDelete} disabled={saving}>
                      Delete
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="jn-btn-primary"
                    data-testid="jn-save"
                    onClick={onSave}
                    disabled={saving || (!title.trim() && !body.trim())}
                  >
                    {saving ? "Saving..." : selectedId == null ? "Save note" : "Save changes"}
                  </button>
                </div>
              </footer>
            </article>
          )}
        </section>
      </div>
    </div>
  );
}
