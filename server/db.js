import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { PRACTICES_CATALOG } from "./practicesCatalog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function openDatabase(dataDir) {
  const path = join(dataDir, "watts-calm.db");
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  return db;
}

function listColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

function migrateChatSessions(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT 'New chat',
      persona_key TEXT,
      persona_name TEXT,
      persona_source TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const sessionCols = listColumns(db, "chat_sessions");
  if (!sessionCols.includes("persona_key")) {
    db.exec(`ALTER TABLE chat_sessions ADD COLUMN persona_key TEXT;`);
  }
  if (!sessionCols.includes("persona_name")) {
    db.exec(`ALTER TABLE chat_sessions ADD COLUMN persona_name TEXT;`);
  }
  if (!sessionCols.includes("persona_source")) {
    db.exec(`ALTER TABLE chat_sessions ADD COLUMN persona_source TEXT;`);
  }

  const msgCols = listColumns(db, "chat_messages");
  if (!msgCols.includes("session_id")) {
    db.exec(`ALTER TABLE chat_messages ADD COLUMN session_id INTEGER;`);
  }

  if (db.prepare("SELECT COUNT(*) as c FROM chat_sessions").get().c === 0) {
    const title = db.prepare("SELECT COUNT(*) as c FROM chat_messages").get().c
      ? "Previous chat"
      : "New chat";
    const r = db
      .prepare("INSERT INTO chat_sessions (title) VALUES (?) RETURNING id")
      .get(title);
    const sid = r.id;
    db.prepare("UPDATE chat_messages SET session_id = ? WHERE session_id IS NULL OR session_id = 0").run(
      sid
    );
  } else {
    const sid = db.prepare("SELECT id FROM chat_sessions ORDER BY id ASC LIMIT 1").get().id;
    db.prepare("UPDATE chat_messages SET session_id = ? WHERE session_id IS NULL OR session_id = 0").run(
      sid
    );
  }
}

function seedFromCatalog(db) {
  const hasTags = listColumns(db, "practices").includes("tags");
  const ins = hasTags
    ? db.prepare(
        `INSERT INTO practices (title, summary, category, sort_order, tags, est_minutes)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
    : db.prepare("INSERT INTO practices (title, summary, category, sort_order) VALUES (?, ?, ?, ?)");
  const tx = db.transaction(() => {
    PRACTICES_CATALOG.forEach((p, i) => {
      if (hasTags) {
        ins.run(
          p.title,
          p.summary,
          p.category,
          i,
          JSON.stringify(p.tags),
          p.est_minutes != null ? p.est_minutes : 10
        );
      } else {
        ins.run(p.title, p.summary, p.category, i);
      }
    });
  });
  tx();
}

function ensureNotesFts(db) {
  const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notes_fts'").get();
  if (!t) {
    db.exec(`
      CREATE VIRTUAL TABLE notes_fts USING fts5(
        title, body, content=notes, content_rowid=id
      );
    `);
    try {
      db.exec(`INSERT INTO notes_fts(notes_fts) VALUES('rebuild');`);
    } catch (e) {
      console.error("notes_fts rebuild", e);
    }
  }

  // External-content FTS5: use 'delete' rows per SQLite docs; DELETE FROM the shadow table fails updates.
  db.exec(`
    DROP TRIGGER IF EXISTS notes_fts_ins;
    DROP TRIGGER IF EXISTS notes_fts_upd;
    DROP TRIGGER IF EXISTS notes_fts_del;
    CREATE TRIGGER notes_fts_ins AFTER INSERT ON notes BEGIN
      INSERT INTO notes_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
    END;
    CREATE TRIGGER notes_fts_upd AFTER UPDATE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES('delete', old.id, old.title, old.body);
      INSERT INTO notes_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
    END;
    CREATE TRIGGER notes_fts_del AFTER DELETE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES('delete', old.id, old.title, old.body);
    END;
  `);
}

function tryAddColumn(db, table, columnName, alterSql) {
  if (listColumns(db, table).includes(columnName)) return;
  try {
    db.exec(alterSql);
  } catch (e) {
    if (!String(e?.message || e).includes("duplicate column name")) {
      throw e;
    }
  }
}

/**
 * Migrations: preferences, events, note provenance, practice tags, FTS, extra practices.
 */
function migrateAppFeatures(db) {
  tryAddColumn(
    db,
    "notes",
    "source_session_id",
    "ALTER TABLE notes ADD COLUMN source_session_id INTEGER REFERENCES chat_sessions(id);"
  );
  tryAddColumn(
    db,
    "notes",
    "note_type",
    "ALTER TABLE notes ADD COLUMN note_type TEXT NOT NULL DEFAULT 'general';"
  );
  tryAddColumn(
    db,
    "notes",
    "title_auto",
    "ALTER TABLE notes ADD COLUMN title_auto INTEGER NOT NULL DEFAULT 0;"
  );

  tryAddColumn(
    db,
    "practices",
    "tags",
    "ALTER TABLE practices ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';"
  );
  tryAddColumn(
    db,
    "practices",
    "est_minutes",
    "ALTER TABLE practices ADD COLUMN est_minutes INTEGER NOT NULL DEFAULT 10;"
  );
  const pCols = listColumns(db, "practices");

  db.exec(`
    CREATE TABLE IF NOT EXISTS practice_favorites (
      practice_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (practice_id),
      FOREIGN KEY (practice_id) REFERENCES practices(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS custom_agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      system_prompt TEXT NOT NULL DEFAULT '',
      short_description TEXT NOT NULL DEFAULT '',
      role_purpose TEXT NOT NULL DEFAULT '',
      tone TEXT NOT NULL DEFAULT 'Gentle',
      speaking_style TEXT NOT NULL DEFAULT 'Short and supportive',
      encouragement_style TEXT NOT NULL DEFAULT 'Balanced',
      focus_areas_json TEXT NOT NULL DEFAULT '[]',
      boundaries_json TEXT NOT NULL DEFAULT '{}',
      context_access_json TEXT NOT NULL DEFAULT '{}',
      behavior_tuning_json TEXT NOT NULL DEFAULT '{}',
      custom_instructions TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  tryAddColumn(
    db,
    "custom_agents",
    "short_description",
    "ALTER TABLE custom_agents ADD COLUMN short_description TEXT NOT NULL DEFAULT '';"
  );
  tryAddColumn(
    db,
    "custom_agents",
    "role_purpose",
    "ALTER TABLE custom_agents ADD COLUMN role_purpose TEXT NOT NULL DEFAULT '';"
  );
  tryAddColumn(
    db,
    "custom_agents",
    "tone",
    "ALTER TABLE custom_agents ADD COLUMN tone TEXT NOT NULL DEFAULT 'Gentle';"
  );
  tryAddColumn(
    db,
    "custom_agents",
    "speaking_style",
    "ALTER TABLE custom_agents ADD COLUMN speaking_style TEXT NOT NULL DEFAULT 'Short and supportive';"
  );
  tryAddColumn(
    db,
    "custom_agents",
    "encouragement_style",
    "ALTER TABLE custom_agents ADD COLUMN encouragement_style TEXT NOT NULL DEFAULT 'Balanced';"
  );
  tryAddColumn(
    db,
    "custom_agents",
    "focus_areas_json",
    "ALTER TABLE custom_agents ADD COLUMN focus_areas_json TEXT NOT NULL DEFAULT '[]';"
  );
  tryAddColumn(
    db,
    "custom_agents",
    "boundaries_json",
    "ALTER TABLE custom_agents ADD COLUMN boundaries_json TEXT NOT NULL DEFAULT '{}';"
  );
  tryAddColumn(
    db,
    "custom_agents",
    "context_access_json",
    "ALTER TABLE custom_agents ADD COLUMN context_access_json TEXT NOT NULL DEFAULT '{}';"
  );
  tryAddColumn(
    db,
    "custom_agents",
    "behavior_tuning_json",
    "ALTER TABLE custom_agents ADD COLUMN behavior_tuning_json TEXT NOT NULL DEFAULT '{}';"
  );
  tryAddColumn(
    db,
    "custom_agents",
    "custom_instructions",
    "ALTER TABLE custom_agents ADD COLUMN custom_instructions TEXT NOT NULL DEFAULT '';"
  );
  tryAddColumn(
    db,
    "custom_agents",
    "is_active",
    "ALTER TABLE custom_agents ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0;"
  );

  db.prepare(
    `UPDATE custom_agents
     SET custom_instructions = system_prompt
     WHERE (custom_instructions IS NULL OR custom_instructions = '')
       AND system_prompt IS NOT NULL
       AND system_prompt != ''`
  ).run();

  for (const p of PRACTICES_CATALOG) {
    const ex = db.prepare("SELECT id FROM practices WHERE title = ?").get(p.title);
    if (ex) {
      if (pCols.includes("tags")) {
        db.prepare("UPDATE practices SET tags = ?, est_minutes = ? WHERE id = ?").run(
          JSON.stringify(p.tags),
          p.est_minutes != null ? p.est_minutes : 10,
          ex.id
        );
      }
    } else {
      const maxO = db.prepare("SELECT IFNULL(MAX(sort_order), -1) + 1 AS o FROM practices").get().o;
      if (pCols.includes("tags")) {
        db.prepare(
          "INSERT INTO practices (title, summary, category, sort_order, tags, est_minutes) VALUES (?, ?, ?, ?, ?, ?)"
        ).run(
          p.title,
          p.summary,
          p.category,
          maxO,
          JSON.stringify(p.tags),
          p.est_minutes != null ? p.est_minutes : 10
        );
      } else {
        db
          .prepare("INSERT INTO practices (title, summary, category, sort_order) VALUES (?, ?, ?, ?)")
          .run(p.title, p.summary, p.category, maxO);
      }
    }
  }

  for (const row of db.prepare("SELECT id, category, tags, est_minutes FROM practices").all()) {
    const tagsRaw = row.tags;
    if (
      tagsRaw == null ||
      String(tagsRaw) === "[]" ||
      String(tagsRaw) === "null" ||
      String(tagsRaw).trim() === ""
    ) {
      const cat = [String(row.category || "general")];
      db.prepare("UPDATE practices SET tags = ?, est_minutes = ? WHERE id = ?").run(
        JSON.stringify(cat),
        (row.est_minutes != null && row.est_minutes > 0) ? row.est_minutes : 10,
        row.id
      );
    }
  }

  ensureNotesFts(db);
}

export function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS practices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL DEFAULT '',
      suggestions_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const { count } = db.prepare("SELECT COUNT(*) as count FROM practices").get();
  if (count === 0) {
    seedFromCatalog(db);
  }

  migrateChatSessions(db);
  migrateAppFeatures(db);
}

export { PRACTICES_CATALOG } from "./practicesCatalog.js";
