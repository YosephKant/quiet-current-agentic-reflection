import type { ChatMessage } from "../../types";

export function MessageBubble({
  m,
  onSaveToNote,
  guideLabel = "Guide",
}: {
  m: ChatMessage;
  onSaveToNote?: (content: string) => void;
  guideLabel?: string;
}) {
  const isUser = m.role === "user";
  return (
    <div className={"qc-msg qc-msg--" + (isUser ? "user" : "assistant")}>
      {!isUser && <div className="qc-msg__pearl" aria-hidden="true" />}
      <div className={"bubble qc-msg__bubble " + (isUser ? "user" : "assistant")}>
        <div className="bubble-label-row">
          <div className="label">{isUser ? "You" : guideLabel}</div>
          {!isUser && onSaveToNote && (
            <button type="button" className="btn btn-ghost to-note-btn" onClick={() => onSaveToNote(m.content)}>
              To note
            </button>
          )}
        </div>
        <div className="bubble-content" style={{ whiteSpace: "pre-wrap" }}>
          {m.content}
        </div>
        {m.created_at && (
          <div className="qc-msg__time">
            {new Date(m.created_at.includes("T") ? m.created_at : m.created_at.replace(" ", "T")).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>
    </div>
  );
}
