import type { AgentPersona } from "../types";

export const AGENTS_STORAGE_KEY = "watts-calm-agents-v1";

export const AGENTS_UPDATED_EVENT = "watts-calm-agents-updated";

export function notifyAgentsUpdated() {
  window.dispatchEvent(new Event(AGENTS_UPDATED_EVENT));
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "ag_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function loadAgents(): AgentPersona[] {
  try {
    const raw = localStorage.getItem(AGENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        const o = row as Record<string, unknown>;
        const id = String(o.id ?? "").trim();
        const name = String(o.name ?? "").trim();
        const systemPrompt = String(o.systemPrompt ?? "").trim();
        const description = String(o.description ?? "").trim();
        const createdAt = String(o.createdAt ?? new Date().toISOString());
        if (!id || !name || !systemPrompt) return null;
        return { id, name, description, systemPrompt, createdAt } satisfies AgentPersona;
      })
      .filter((x): x is AgentPersona => x != null);
  } catch {
    return [];
  }
}

export function saveAgents(agents: AgentPersona[]) {
  localStorage.setItem(AGENTS_STORAGE_KEY, JSON.stringify(agents));
  notifyAgentsUpdated();
}

export function createAgentPersona(partial: {
  name: string;
  description?: string;
  systemPrompt: string;
}): AgentPersona {
  return {
    id: randomId(),
    name: partial.name.trim(),
    description: (partial.description ?? "").trim(),
    systemPrompt: partial.systemPrompt.trim(),
    createdAt: new Date().toISOString(),
  };
}
