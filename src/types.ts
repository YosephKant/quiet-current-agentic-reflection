export type NoteKind = "general" | "gratitude" | "reflection" | "intention" | "idea" | "practice";

export type Note = {
  id: number;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  source_session_id?: number | null;
  note_type?: NoteKind | string;
  title_auto?: number;
};

export type Practice = {
  id: number;
  title: string;
  summary: string;
  category: string;
  sort_order: number;
  tags?: string[];
  est_minutes?: number;
  is_favorite?: boolean;
};

export type ChatMessage = {
  id?: number;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

export type ChatSession = {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  persona_key?: string | null;
  persona_name?: string | null;
  persona_source?: "builtin" | "server" | "local" | string | null;
  message_count?: number;
};

export type HomeSnapshot = {
  intention: string;
  statsOptIn: boolean;
  streak: number;
  lastNote: {
    id: number;
    title: string;
    lastLine: string;
    note_type?: string;
    updated_at?: string;
  } | null;
  lastSession: { id: number; title: string; updated_at: string } | null;
  suggestedPractice: { id: number; title: string; summary: string; category: string } | null;
  gratitudeCount: number;
};

export type AgentPersona = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  createdAt: string;
};

export type Tab =
  | "home"
  | "habits"
  | "weekly"
  | "insights"
  | "guide_builder"
  | "notes"
  | "practices"
  | "chat"
  | "privacy"
  | "horoscope"
  | "ambience";

/** URL query aliases → consolidated Guide builder area */
export type GuideBuilderSection = "teachers" | "agents";
