/**
 * Reads a fetch Response body as JSON when possible; otherwise preserves text
 * so proxy/HTML error pages (e.g. API not running) still surface something useful.
 */
export type ApiJsonBody = {
  error?: string;
  hint?: string;
  [key: string]: unknown;
};

export async function readApiJson<T extends ApiJsonBody = ApiJsonBody>(
  r: Response
): Promise<{ ok: boolean; status: number; json: T }> {
  const text = await r.text();
  let json: unknown = {};
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      const snippet = text.replace(/\s+/g, " ").trim().slice(0, 500);
      json = {
        error: snippet || `Request failed (${r.status} ${r.statusText || ""})`.trim(),
      };
    }
  } else {
    json = { error: r.statusText || `HTTP ${r.status} (empty response)` };
  }
  if (typeof json !== "object" || json === null) {
    json = { error: `Unexpected response (${r.status})` };
  }
  return { ok: r.ok, status: r.status, json: json as T };
}

export function formatApiErrorMessage(j: ApiJsonBody, fallback: string): string {
  const err = typeof j.error === "string" && j.error.trim() ? j.error.trim() : "";
  const hint = typeof j.hint === "string" && j.hint.trim() ? j.hint.trim() : "";
  if (err && hint) return `${err} — ${hint}`;
  if (err) return err;
  if (hint) return hint;
  return fallback;
}
