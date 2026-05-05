import type { MouseEvent } from "react";
import type { ChatSession } from "../../types";
import { groupChatSessions, sessionTimeMs } from "../../lib/chatSessions";

function sortByRecency(sessions: ChatSession[]): ChatSession[] {
  return [...sessions].sort((a, b) => sessionTimeMs(b) - sessionTimeMs(a));
}

function personaName(session: ChatSession) {
  return String(session.persona_name || "").trim() || "Unknown persona";
}

function sessionDate(session: ChatSession) {
  const raw = session.updated_at || session.created_at;
  if (!raw) return "";
  return new Date(raw.includes("T") ? raw : raw.replace(" ", "T")).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function RecentConversationsCard({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
}: {
  sessions: ChatSession[];
  activeSessionId: number | null;
  onSelectSession: (id: number) => void;
  onDeleteSession: (id: number, e: MouseEvent) => void;
}) {
  const grouped = groupChatSessions(sessions);
  const preview = sortByRecency(sessions).slice(0, 4);

  return (
    <section className="qc-guide-rail-card qc-guide-rail-card--recent" id="recent-conversations" aria-labelledby="qc-guide-recent-heading">
      <h2 id="qc-guide-recent-heading" className="qc-guide-rail-card__title">
        Recent conversations
      </h2>
      {sessions.length === 0 ? (
        <p className="qc-guide-recent-empty">No saved chats yet.</p>
      ) : (
        <>
          <ul className="qc-guide-recent-preview" role="list">
            {preview.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={"qc-guide-recent-row" + (s.id === activeSessionId ? " qc-guide-recent-row--active" : "")}
                  onClick={() => onSelectSession(s.id)}
                >
                  <span className="qc-guide-recent-row__icon" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </span>
                  <span className="qc-guide-recent-row__copy">
                    <span className="qc-guide-recent-row__title">{s.title || "Chat"}</span>
                    <span className="qc-guide-recent-row__meta">
                      {personaName(s)} {sessionDate(s) ? "- " + sessionDate(s) : ""}
                    </span>
                  </span>
                  <span className="qc-guide-recent-row__chev" aria-hidden>
                    &rsaquo;
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <details className="qc-guide-recent-details">
            <summary className="qc-guide-view-all">View all conversations</summary>
            <div className="qc-guide-recent-scroll">
              {grouped.map(
                (g) =>
                  g.items.length > 0 && (
                    <div key={g.key} className="qc-guide-recent-group">
                      <h3 className="qc-guide-recent-group__label">{g.label}</h3>
                      <ul className="qc-guide-recent-list" role="list">
                        {g.items.map((s) => (
                          <li key={s.id} className="qc-guide-recent-li">
                            <button
                              type="button"
                              className={"qc-guide-recent-tab" + (s.id === activeSessionId ? " qc-guide-recent-tab--active" : "")}
                              onClick={() => onSelectSession(s.id)}
                            >
                              <span className="qc-guide-recent-tab__copy">
                                <span className="qc-guide-recent-tab__title">{s.title || "Chat"}</span>
                                <span className="qc-guide-recent-tab__meta">{personaName(s)}</span>
                              </span>
                              {typeof s.message_count === "number" && s.message_count > 0 && (
                                <span className="qc-guide-recent-tab__count">{Math.ceil(s.message_count / 2)}</span>
                              )}
                            </button>
                            <button
                              type="button"
                              className="qc-guide-recent-del"
                              aria-label={"Delete chat " + (s.title || "untitled")}
                              onClick={(e) => onDeleteSession(s.id, e)}
                            >
                              x
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
              )}
            </div>
          </details>
        </>
      )}
    </section>
  );
}
