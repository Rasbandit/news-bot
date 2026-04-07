import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDb, type NewsDb } from "./db.js";

describe("NewsDb", () => {
  let db: NewsDb;

  beforeEach(() => {
    db = createDb(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("marks articles as seen", () => {
    db.markSeen("abc123", "https://example.com", "Test Article", "TestSource");
    expect(db.getSeenHashes()).toContain("abc123");
  });

  it("returns empty set when no articles seen", () => {
    expect(db.getSeenHashes().size).toBe(0);
  });

  it("prunes articles older than specified days", () => {
    // Insert an old article by manipulating the timestamp
    db.markSeen("old1", "https://example.com/old", "Old Article", "Source");

    // Manually backdate it
    db.raw.prepare("UPDATE seen_articles SET posted_at = ?").run(
      Date.now() - 10 * 24 * 60 * 60 * 1000 // 10 days ago
    );

    db.prune(7);
    expect(db.getSeenHashes().size).toBe(0);
  });

  it("keeps recent articles during prune", () => {
    db.markSeen("new1", "https://example.com/new", "New Article", "Source");
    db.prune(7);
    expect(db.getSeenHashes()).toContain("new1");
  });
});
