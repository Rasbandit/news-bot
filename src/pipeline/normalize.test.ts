import { describe, it, expect } from "vitest";
import { normalizeArticles } from "./normalize.js";
import type { RawArticle } from "../types.js";

function makeRaw(overrides: Partial<RawArticle> = {}): RawArticle {
  return {
    title: "Test Article",
    description: "<p>Some <b>HTML</b> description</p>",
    link: "https://example.com/article",
    publishedAt: new Date(),
    source: "Test Source",
    category: "tech",
    ...overrides,
  };
}

describe("normalizeArticles", () => {
  it("strips HTML from descriptions", () => {
    const result = normalizeArticles([makeRaw()], 24);
    expect(result[0].description).toBe("Some HTML description");
  });

  it("truncates long descriptions to maxLength", () => {
    const long = "A".repeat(300);
    const result = normalizeArticles(
      [makeRaw({ description: long })],
      24,
      200
    );
    expect(result[0].description.length).toBeLessThanOrEqual(203); // 200 + "..."
  });

  it("filters out articles older than maxAgeHours", () => {
    const old = new Date();
    old.setHours(old.getHours() - 48);
    const result = normalizeArticles(
      [makeRaw({ publishedAt: old }), makeRaw({ publishedAt: new Date() })],
      24
    );
    expect(result).toHaveLength(1);
  });

  it("filters out articles with null publishedAt", () => {
    const result = normalizeArticles([makeRaw({ publishedAt: null })], 24);
    expect(result).toHaveLength(0);
  });

  it("preserves all fields in output", () => {
    const result = normalizeArticles([makeRaw()], 24);
    expect(result[0]).toHaveProperty("title", "Test Article");
    expect(result[0]).toHaveProperty("link", "https://example.com/article");
    expect(result[0]).toHaveProperty("source", "Test Source");
    expect(result[0]).toHaveProperty("category", "tech");
  });
});
