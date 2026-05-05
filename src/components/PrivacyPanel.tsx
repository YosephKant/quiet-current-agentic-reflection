import { useState } from "react";
import { PageHeader } from "./ui/PageHeader";

export function PrivacyPanel() {
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onExport() {
    setErr(null);
    setHint(null);
    setBusy(true);
    try {
      const r = await fetch("/api/privacy/export");
      if (!r.ok) {
        setErr("Could not export data.");
        return;
      }
      const data = await r.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quiet-current-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setHint("Export downloaded.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteAll() {
    if (!window.confirm("Delete all notes, chats, streaks, and preferences on this device?")) return;
    setErr(null);
    setHint(null);
    setBusy(true);
    try {
      const r = await fetch("/api/privacy/delete-all-data", { method: "DELETE" });
      if (!r.ok) {
        setErr("Could not delete data.");
        return;
      }
      setHint("All local data cleared.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel privacy-settings">
      <PageHeader
        title="Privacy & Data"
        subtitle="This app is local-first: your notes, chats, habits, and streaks are stored on this device. You can export or wipe everything at any time."
      />

      <div className="privacy-actions">
        <button type="button" className="btn btn-primary" onClick={() => void onExport()} disabled={busy}>
          Export my data
        </button>
        <button type="button" className="btn btn-danger" onClick={() => void onDeleteAll()} disabled={busy}>
          Delete all local data
        </button>
      </div>

      {hint && <p className="hint">{hint}</p>}
      {err && <p className="err">{err}</p>}
      <p className="muted" style={{ marginTop: "1rem" }}>
        PWA-ready architecture: this UI is prepared to be wrapped with Capacitor for iOS later.
      </p>
    </div>
  );
}

