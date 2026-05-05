/**
 * @param {import("better-sqlite3").Database} db
 * @param {string} userText
 * @param {number} limit
 * @returns {{ id: number; title: string; body: string; snippet: string }[]}
 */
export function searchNotesForRag(db, userText, limit = 3) {
  const tokens = String(userText)
    .toLowerCase()
    .match(/[a-z0-9]{3,}/gi);
  if (!tokens || tokens.length === 0) return [];

  const phrase = tokens
    .slice(0, 6)
    .map((t) => {
      const x = t.replace(/"/g, '""');
      return `"${x}"*`;
    })
    .join(" OR ");

  let rows;
  try {
    rows = db
      .prepare(
        `SELECT n.id, n.title, n.body
         FROM notes n
         WHERE n.id IN (SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?)
         LIMIT ?`
      )
      .all(phrase, limit);
  } catch {
    return [];
  }
  if (!Array.isArray(rows) || rows.length === 0) return [];

  return rows.map((r) => {
    const body = String(r.body || "");
    const take = 220;
    const snip = body.length <= take ? body : body.slice(0, take).trim() + "…";
    return {
      id: r.id,
      title: String(r.title || ""),
      body,
      snippet: snip,
    };
  });
}

/**
 * @param {import("better-sqlite3").Database} db
 * @param {string} q
 * @param {number} limit
 */
export function searchNotesFullText(db, q, limit = 50) {
  const raw = String(q || "").trim();
  if (raw.length < 1) {
    return db
      .prepare("SELECT * FROM notes ORDER BY updated_at DESC, id DESC LIMIT ?")
      .all(limit);
  }
  const tokens = raw
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 8);
  if (tokens.length === 0) {
    return [];
  }
  const phrase = tokens
    .map((t) => {
      const x = t.replace(/"/g, '""');
      return `"${x}"*`;
    })
    .join(" OR ");
  try {
    return db
      .prepare(
        `SELECT n.* FROM notes n
         WHERE n.id IN (SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?)
         ORDER BY n.updated_at DESC
         LIMIT ?`
      )
      .all(phrase, limit);
  } catch {
    return db
      .prepare("SELECT * FROM notes WHERE body LIKE ? OR title LIKE ? ORDER BY updated_at DESC LIMIT ?")
      .all("%" + raw + "%", "%" + raw + "%", limit);
  }
}
