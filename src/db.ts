import Database from "better-sqlite3";

export interface NewsDb {
  raw: Database.Database;
  markSeen(hash: string, url: string, title: string, source: string): void;
  getSeenHashes(): Set<string>;
  prune(maxAgeDays: number): void;
  close(): void;
}

export function createDb(path: string): NewsDb {
  const db = new Database(path);

  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS seen_articles (
      hash TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      posted_at INTEGER NOT NULL
    )
  `);

  const insertStmt = db.prepare(
    "INSERT OR IGNORE INTO seen_articles (hash, url, title, source, posted_at) VALUES (?, ?, ?, ?, ?)"
  );
  const selectHashesStmt = db.prepare("SELECT hash FROM seen_articles");
  const pruneStmt = db.prepare("DELETE FROM seen_articles WHERE posted_at < ?");

  return {
    raw: db,

    markSeen(hash, url, title, source) {
      insertStmt.run(hash, url, title, source, Date.now());
    },

    getSeenHashes() {
      const rows = selectHashesStmt.all() as { hash: string }[];
      return new Set(rows.map((r) => r.hash));
    },

    prune(maxAgeDays) {
      const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
      pruneStmt.run(cutoff);
    },

    close() {
      db.close();
    },
  };
}
