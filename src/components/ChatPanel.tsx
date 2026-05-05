import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { ChatMessage, ChatSession, Practice } from "../types";
import { AGENTS_UPDATED_EVENT, loadAgents } from "../lib/agentPersonas";
import {
  AIStatusPill,
  GuideHeader,
  GuideHowHelpsCard,
  GuideInfoPanel,
  GuidePrivacyCard,
  MessageBubble,
  RecentConversationsCard,
} from "./guide";

type ChatConfig = { mode: string; model: string; ollamaUrl: string };

type GuidePick = {
  key: string;
  name: string;
  serverId?: number;
  localSystemPrompt?: string;
  source: "server" | "local";
};

type PersonaContext = {
  key: string;
  name: string;
  source: "builtin" | "server" | "local" | "unknown";
  label: string;
};

const BUILT_IN_PERSONA: PersonaContext = {
  key: "builtin:presence",
  name: "Presence",
  source: "builtin",
  label: "Built-in calm voice",
};

function sourceLabel(source: PersonaContext["source"]) {
  if (source === "server") return "Saved guide";
  if (source === "local") return "This device";
  if (source === "unknown") return "Original guide unknown";
  return "Built-in calm voice";
}

function sessionPersona(session: ChatSession | null | undefined): PersonaContext {
  const name = String(session?.persona_name ?? "").trim();
  const key = String(session?.persona_key ?? "").trim();
  const rawSource = String(session?.persona_source ?? "").trim();
  const source =
    rawSource === "server" || rawSource === "local" || rawSource === "builtin"
      ? rawSource
      : "unknown";
  if (!name && !key) {
    return { key: "", name: "Unknown persona", source: "unknown", label: "Older chat without saved persona" };
  }
  return {
    key,
    name: name || "Unknown persona",
    source,
    label: sourceLabel(source),
  };
}

export function ChatPanel({
  focusSessionId = null,
  onFocusSessionConsumed,
}: {
  focusSessionId?: number | null;
  onFocusSessionConsumed?: () => void;
} = {}) {
  const initialFocus = useRef(focusSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [relatedPracticeId, setRelatedPracticeId] = useState<number | "">("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [config, setConfig] = useState<ChatConfig | null>(null);
  const [guidePicks, setGuidePicks] = useState<GuidePick[]>([]);
  const [selectedGuideKey, setSelectedGuideKey] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  function currentPersona(): PersonaContext {
    const pick = guidePicks.find((p) => p.key === selectedGuideKey);
    if (!pick) return BUILT_IN_PERSONA;
    return {
      key: pick.key,
      name: pick.name,
      source: pick.source,
      label: sourceLabel(pick.source),
    };
  }

  function personaSessionPayload() {
    const persona = currentPersona();
    return {
      personaKey: persona.key,
      personaName: persona.name,
      personaSource: persona.source,
    };
  }

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/chat/config");
      if (r.ok) {
        setConfig((await r.json()) as ChatConfig);
      }
    })();
  }, []);

  useEffect(() => {
    async function refreshGuidePicks() {
      const local = loadAgents();
      let serverRows: { id: number; name: string; system_prompt: string; is_active?: number }[] = [];
      try {
        const r = await fetch("/api/agents");
        if (r.ok) {
          const j = (await r.json()) as unknown;
          if (Array.isArray(j)) serverRows = j as typeof serverRows;
        }
      } catch {
        /* offline */
      }
      const picks: GuidePick[] = [
        ...serverRows.map((row) => ({
          key: "srv:" + row.id,
          name: row.name,
          serverId: row.id,
          source: "server" as const,
        })),
        ...local.map((a) => ({
          key: "loc:" + a.id,
          name: a.name,
          localSystemPrompt: a.systemPrompt,
          source: "local" as const,
        })),
      ];
      setGuidePicks(picks);
      setSelectedGuideKey((prev) => {
        const activeServer = serverRows.find((row) => row.is_active === 1);
        if (!prev) return activeServer ? "srv:" + activeServer.id : prev;
        return picks.some((p) => p.key === prev) ? prev : "";
      });
    }

    function onAgentsUpdated() {
      void refreshGuidePicks();
    }
    void refreshGuidePicks();
    window.addEventListener(AGENTS_UPDATED_EVENT, onAgentsUpdated);
    return () => window.removeEventListener(AGENTS_UPDATED_EVENT, onAgentsUpdated);
  }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/practices");
      if (r.ok) {
        setPractices((await r.json()) as Practice[]);
      }
    })();
  }, []);

  async function refreshSessions() {
    const r = await fetch("/api/chat/sessions");
    if (!r.ok) return;
    const list = (await r.json()) as ChatSession[];
    if (!Array.isArray(list)) return;
    setSessions(list);
  }

  async function loadMessagesForSession(sessionId: number) {
    const r = await fetch(`/api/chat/messages?sessionId=${encodeURIComponent(String(sessionId))}`);
    if (!r.ok) return;
    const rows = (await r.json()) as ChatMessage[];
    if (!Array.isArray(rows)) return;
    setMessages(
      rows.map((m) => ({
        id: m.id,
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
        created_at: m.created_at,
      }))
    );
  }

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/chat/sessions");
      if (!r.ok) return;
      let list = (await r.json()) as ChatSession[];
      if (Array.isArray(list) && list.length > 0) {
        setSessions(list);
        const f = initialFocus.current;
        const want = f != null && list.some((s) => s.id === f) ? f : list[0].id;
        setActiveSessionId(want);
        onFocusSessionConsumed?.();
        return;
      }
      const cr = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "New chat", ...personaSessionPayload() }),
      });
      if (cr.ok) {
        const s = (await cr.json()) as ChatSession;
        setSessions([s]);
        setActiveSessionId(s.id);
        onFocusSessionConsumed?.();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time session bootstrap
  }, []);

  useEffect(() => {
    if (activeSessionId == null) return;
    void loadMessagesForSession(activeSessionId);
  }, [activeSessionId]);

  async function onNewSession() {
    setErr(null);
    setHint(null);
    const r = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "New chat", ...personaSessionPayload() }),
    });
    if (!r.ok) return;
    const s = (await r.json()) as ChatSession;
    setSessions((prev) => [s, ...prev.filter((x) => x.id !== s.id)]);
    setActiveSessionId(s.id);
    setMessages([]);
  }

  async function onSelectSession(id: number) {
    if (id === activeSessionId) return;
    setErr(null);
    setHint(null);
    setActiveSessionId(id);
  }

  async function onDeleteSession(id: number, e: MouseEvent) {
    e.stopPropagation();
    if (!window.confirm("Delete this chat and all its messages?")) return;
    const r = await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
    if (!r.ok) return;
    const wasActive = activeSessionId === id;
    const resList = await fetch("/api/chat/sessions");
    if (resList.ok) {
      let list = (await resList.json()) as ChatSession[];
      if (wasActive && list.length === 0) {
        const cr = await fetch("/api/chat/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "New chat", ...personaSessionPayload() }),
        });
        if (cr.ok) {
          const s = (await cr.json()) as ChatSession;
          list = [s];
        }
        setMessages([]);
        setActiveSessionId(list[0]?.id ?? null);
      } else {
        if (wasActive) {
          setActiveSessionId(list[0]?.id ?? null);
        }
        if (wasActive) setMessages([]);
      }
      setSessions(list);
    }
  }

  async function saveMessageToNote(text: string) {
    if (activeSessionId == null) return;
    const t = (text || "").trim().slice(0, 20_000);
    const r = await fetch("/api/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "",
        body: t + "\n\nSaved from chat session " + activeSessionId,
        sourceSessionId: activeSessionId,
        noteType: "general",
      }),
    });
    if (r.ok) {
      setHint("Saved to Notes.");
      window.setTimeout(() => setHint(null), 3000);
    } else {
      setErr("Could not save to note.");
    }
  }

  async function onClearThisChat() {
    if (activeSessionId == null) return;
    if (!window.confirm("Clear all messages in this chat? (The session stays open.)")) return;
    const r = await fetch(`/api/chat/messages?sessionId=${encodeURIComponent(String(activeSessionId))}`, {
      method: "DELETE",
    });
    if (r.ok) {
      setMessages([]);
      setErr(null);
      setHint(null);
      await refreshSessions();
    }
  }

  async function onGeneratePracticeFromChat() {
    if (activeSessionId == null) return;
    setErr(null);
    setHint(null);
    try {
      const r = await fetch("/api/practices/generate-from-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: activeSessionId }),
      });
      const data = (await r.json().catch(() => ({}))) as { title?: string; error?: string };
      if (!r.ok) {
        setErr(data.error || "Could not generate a practice from this chat.");
        return;
      }
      const rr = await fetch("/api/practices");
      if (rr.ok) setPractices((await rr.json()) as Practice[]);
      setHint(`Practice created: ${String(data.title || "Generated practice")}`);
      window.setTimeout(() => setHint(null), 5000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not generate a practice from this chat.");
    }
  }

  async function onSend() {
    const t = input.trim();
    if (!t || sending || activeSessionId == null) return;

    const nextUser: ChatMessage = { role: "user", content: t };
    setInput("");
    setErr(null);
    setHint(null);

    const forApi: ChatMessage[] = [...messages, nextUser];
    setMessages(forApi);
    setSending(true);
    const forApiSnapshot = forApi;
    const pick = guidePicks.find((p) => p.key === selectedGuideKey);
    const bodyPayload: Record<string, unknown> = {
      sessionId: activeSessionId,
      relatedPracticeId: relatedPracticeId === "" || relatedPracticeId == null ? undefined : relatedPracticeId,
      messages: forApi.map((m) => ({ role: m.role, content: m.content })),
      ...personaSessionPayload(),
    };
    if (pick?.serverId != null) {
      bodyPayload.agentId = pick.serverId;
    } else if (pick?.localSystemPrompt) {
      const sp = pick.localSystemPrompt.trim();
      if (sp) bodyPayload.systemPrompt = sp;
    }

    const clientTimeoutMs = 125_000;
    const ac = new AbortController();
    const timer = window.setTimeout(() => ac.abort(), clientTimeoutMs);

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(bodyPayload),
        signal: ac.signal,
      });

      const data = (await r.json().catch(() => ({}))) as {
        role?: string;
        content?: string;
        error?: string;
        detail?: string;
        hint?: string;
      };

      if (!r.ok) {
        setErr(data.error || "Chat request failed");
        if (data.detail) setErr((e) => (e + " — " + data.detail).slice(0, 500));
        if (data.hint) setHint(data.hint);
        await loadMessagesForSession(activeSessionId);
        return;
      }

      if (data.content) {
        const histRes = await fetch(`/api/chat/messages?sessionId=${encodeURIComponent(String(activeSessionId!))}`);
        if (histRes.ok) {
          const rows = (await histRes.json()) as ChatMessage[];
          if (Array.isArray(rows) && rows.length > forApiSnapshot.length && rows[rows.length - 1]?.role === "assistant") {
            setMessages(
              rows.map((m) => ({
                id: m.id,
                role: m.role === "assistant" ? "assistant" : "user",
                content: m.content,
                created_at: m.created_at,
              }))
            );
          } else {
            setMessages([...forApiSnapshot, { role: "assistant", content: data.content } as ChatMessage]);
          }
        } else {
          setMessages([...forApiSnapshot, { role: "assistant", content: data.content } as ChatMessage]);
        }
        await refreshSessions();
      } else {
        setErr("Empty response from the model.");
        await loadMessagesForSession(activeSessionId!);
        await refreshSessions();
      }
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      if (name === "AbortError") {
        setErr("Request took too long and was cancelled.");
        setHint("Start Ollama, run ollama pull " + (config?.model || "llama3.1") + ", then send again.");
      } else {
        setErr(e instanceof Error ? e.message : "Could not reach the chat service.");
        setHint("Check that the dev API is running (npm run dev) and Ollama is started.");
      }
      if (activeSessionId != null) {
        await loadMessagesForSession(activeSessionId);
      }
    } finally {
      window.clearTimeout(timer);
      setSending(false);
    }
  }

  function appendQuickPrompt(fragment: string) {
    setInput((prev) => (prev ? prev.trimEnd() + " " : "") + fragment);
  }

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const selectedPersona = currentPersona();
  const originalPersona = sessionPersona(activeSession);
  const originalPersonaKnown = originalPersona.source !== "unknown";
  const personaDiffers =
    originalPersonaKnown && !!selectedPersona.key && !!originalPersona.key && selectedPersona.key !== originalPersona.key;
  const activeConversationTitle = activeSession?.title?.trim() || "New chat";
  const messageGuideLabel = originalPersonaKnown ? originalPersona.name : selectedPersona.name;

  return (
    <div className="panel chat-panel-outer chat-sanctuary qc-guide-workspace">
      <header className="qc-guide-page-header">
        <GuideHeader />
        <div className="qc-guide-page-header__status">
          <AIStatusPill personaName={selectedPersona.name} personaLabel={selectedPersona.label} />
          <button type="button" className="btn btn-primary qc-guide-header-action" onClick={() => void onNewSession()}>
            New chat
          </button>
          <button
            type="button"
            className="btn qc-guide-settings-trigger"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-expanded={settingsOpen}
            aria-controls="guide-settings-panel"
          >
            Guide settings
          </button>
          <div className="qc-guide-orb qc-guide-orb--hero" aria-hidden />
        </div>
      </header>

      <section
        id="guide-settings-panel"
        className={"qc-guide-advanced" + (settingsOpen ? " qc-guide-advanced--open" : "")}
        hidden={!settingsOpen}
        aria-label="Guide settings"
      >
        <div className="qc-guide-advanced__body">
          <div className="qc-guide-advanced__row">
            <button type="button" className="btn chat-clear" onClick={() => void onClearThisChat()} disabled={activeSessionId == null}>
              Clear this chat
            </button>
            <button type="button" className="btn" onClick={() => void onGeneratePracticeFromChat()} disabled={activeSessionId == null || sending}>
              Generate practice
            </button>
          </div>
          <div className="chat-agent-row qc-guide-advanced__agent">
            <label htmlFor="guide-persona">Guide persona</label>
            <select id="guide-persona" className="pr-select chat-agent-select" value={selectedGuideKey} onChange={(e) => setSelectedGuideKey(e.target.value)}>
              <option value="">Built-in calm voices (alternate)</option>
              {guidePicks.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                  {p.serverId != null ? " · saved on server" : " · this device"}
                </option>
              ))}
            </select>
            <p className="muted chat-agent-hint">
              Guides from Guide builder sync here (server). Older personas may still live on this device only until you re-save them under Guide builder.
            </p>
          </div>
          {config && (
            <p className="config-line">
              Mode: <strong>{config.mode}</strong> · model: {config.model}
            </p>
          )}
          <div className="chat-related-practice">
            <label htmlFor="rel-prac">Related practice (optional, this message only)</label>
            <select
              id="rel-prac"
              className="pr-select"
              value={relatedPracticeId === "" ? "" : String(relatedPracticeId)}
              onChange={(e) => {
                const v = e.target.value;
                setRelatedPracticeId(v === "" ? "" : Number(v));
              }}
            >
              <option value="">None</option>
              {practices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <p className="subtitle qc-guide-advanced__disclaimer">
            Ask about sitting, restlessness, metaphors, or the shape of a practice. This is not professional medical advice.
          </p>
          <p className="muted qc-guide-advanced__ollama">
            Tip: start Ollama and run <code>ollama pull llama3.1</code> if the chat says it cannot reach the model.
          </p>
        </div>
      </section>

      {hint && <p className="hint">{hint}</p>}
      {err && <p className="err">{err}</p>}

      <div className="qc-guide-body">
        <div className="qc-guide-chat-column">
          <div className="guided-chat-vessel chat-main-vessel qc-guide-vessel">
            <div className="guided-chat-vessel-inner">
              <div className="guided-chat-orbit" aria-hidden="true" />
              <div className="chat-box chat-box-framed qc-guide-chat-box">
                <div className="qc-guide-chat-header">
                  <div className="qc-guide-chat-header__main">
                    <span className="qc-guide-chat-header__eyebrow">Current conversation</span>
                    <h2 className="qc-guide-chat-header__title">{activeConversationTitle}</h2>
                    <p className="qc-guide-chat-header__meta">
                      AI guide - Local model
                      {config?.model ? ` - ${config.model}` : ""} - Persona: {selectedPersona.name}
                    </p>
                  </div>
                  <div className="qc-guide-persona-stack" aria-label="Guide persona context">
                    <span className="qc-guide-persona-pill">Persona: {selectedPersona.name}</span>
                    <span className="qc-guide-persona-origin">
                      This chat was created with: {originalPersona.name}
                    </span>
                    {personaDiffers ? (
                      <span className="qc-guide-persona-warning">Current persona differs from original chat persona</span>
                    ) : null}
                  </div>
                </div>
                <div className="chat-log qc-guide-chat-log" role="log" aria-live="polite" aria-relevant="additions">
                  {messages.length === 0 && !sending && (
                    <div className="qc-guide-empty-state">
                      <p className="qc-guide-empty-state__kicker">Begin gently</p>
                      <p className="qc-guide-empty-state__title">What would feel useful to talk through?</p>
                      <p className="qc-guide-empty-state__copy">
                        Start with one sentence. The guide can reflect, notice patterns, or turn the thread into a short practice.
                      </p>
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <MessageBubble
                      key={m.id ?? `m-${i}`}
                      m={m}
                      guideLabel={messageGuideLabel}
                      onSaveToNote={m.role === "assistant" ? saveMessageToNote : undefined}
                    />
                  ))}
                  {sending && (
                    <div className="qc-msg qc-msg--assistant" aria-busy="true">
                      <div className="qc-msg__pearl" aria-hidden />
                      <div className="bubble assistant typing-bubble qc-msg__bubble">
                        <div className="label">Presence</div>
                        <div className="typing-indicator" aria-label="Guide is typing">
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className={"qc-guide-compose" + (sending ? " skel" : "")}>
                  <label htmlFor="chat-input" className="sr-only">
                    Message
                  </label>
                  <textarea
                    id="chat-input"
                    className="qc-guide-compose__input"
                    rows={2}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!sending && input.trim()) void onSend();
                      }
                    }}
                    placeholder="Type your message…"
                    disabled={sending || activeSessionId == null}
                  />
                  <button
                    type="button"
                    className="btn btn-primary qc-guide-send"
                    onClick={() => void onSend()}
                    disabled={sending || !input.trim() || activeSessionId == null}
                    aria-busy={sending}
                    aria-label="Send"
                  >
                    <span className="qc-guide-send__icon" aria-hidden>
                      ↑
                    </span>
                    <span className="qc-guide-send__text">{sending ? "Sending…" : "Send"}</span>
                  </button>
                </div>

                <div className="qc-guide-quick" role="group" aria-label="Quick prompts">
                  <button type="button" className="qc-guide-quick__btn" onClick={() => appendQuickPrompt("Help me reflect more deeply on something I'm carrying today.")}>
                    Reflect deeper
                  </button>
                  <button type="button" className="qc-guide-quick__btn" onClick={() => appendQuickPrompt("Can you help me notice a pattern in how I've been showing up lately?")}>
                    Find a pattern
                  </button>
                  <button type="button" className="qc-guide-quick__btn" onClick={() => void onGeneratePracticeFromChat()} disabled={activeSessionId == null || sending}>
                    Suggest a practice
                  </button>
                </div>

                <p className="qc-guide-footnote">AI responses can make mistakes. Treat this as supportive reflection, not a substitute for professional care.</p>
              </div>
            </div>
          </div>
        </div>

        <aside className="qc-guide-rail" aria-label="Guide tips and history">
          <GuideInfoPanel>
            <GuideHowHelpsCard />
            <RecentConversationsCard
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectSession={(id) => void onSelectSession(id)}
              onDeleteSession={(id, e) => void onDeleteSession(id, e)}
            />
            <GuidePrivacyCard />
          </GuideInfoPanel>
        </aside>
      </div>
    </div>
  );
}
