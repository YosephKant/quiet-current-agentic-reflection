import type { ChatSession } from "../types";

export function sessionTimeMs(s: ChatSession): number {
  const u = s.updated_at || s.created_at;
  if (!u) return 0;
  const normalized = u.includes("T") ? u : u.replace(" ", "T");
  const t = new Date(normalized);
  return Number.isNaN(t.getTime()) ? 0 : t.getTime();
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Subsections: Today, This week (1–6 days back), Earlier (7+ days). */
export function groupChatSessions(sessions: ChatSession[]): { key: string; label: string; items: ChatSession[] }[] {
  const todayStart = startOfLocalDay(new Date());
  const today: ChatSession[] = [];
  const week: ChatSession[] = [];
  const earlier: ChatSession[] = [];

  for (const s of sessions) {
    const u = s.updated_at || s.created_at;
    if (!u) {
      earlier.push(s);
      continue;
    }
    const normalized = u.includes("T") ? u : u.replace(" ", "T");
    const t = new Date(normalized);
    if (Number.isNaN(t.getTime())) {
      earlier.push(s);
      continue;
    }
    const sessionDay = startOfLocalDay(t);
    const dayDiff = (todayStart - sessionDay) / 864e5;
    if (dayDiff < 1) {
      today.push(s);
    } else if (dayDiff < 7) {
      week.push(s);
    } else {
      earlier.push(s);
    }
  }

  const byRecency = (a: ChatSession, b: ChatSession) => sessionTimeMs(b) - sessionTimeMs(a);
  today.sort(byRecency);
  week.sort(byRecency);
  earlier.sort(byRecency);

  return [
    { key: "today", label: "Today", items: today },
    { key: "week", label: "This week", items: week },
    { key: "earlier", label: "Earlier", items: earlier },
  ];
}
