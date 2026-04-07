import { describe, it, expect } from "vitest";
import { hashTitle, wordOverlapRatio, deduplicateArticles } from "./dedup.js";
import type { NormalizedArticle } from "../types.js";

function makeArticle(overrides: Partial<NormalizedArticle> = {}): NormalizedArticle {
  return {
    title: "Test Article Title",
    description: "A test description",
    link: "https://example.com/test",
    publishedAt: new Date(),
    source: "Test Source",
    category: "tech",
    ...overrides,
  };
}

describe("hashTitle", () => {
  it("produces consistent hashes for identical titles", () => {
    expect(hashTitle("Hello World")).toBe(hashTitle("Hello World"));
  });

  it("normalizes case", () => {
    expect(hashTitle("Hello World")).toBe(hashTitle("hello world"));
  });

  it("strips punctuation", () => {
    expect(hashTitle("Hello, World!")).toBe(hashTitle("Hello World"));
  });
});

describe("wordOverlapRatio", () => {
  it("returns 1.0 for identical titles", () => {
    expect(wordOverlapRatio("Hello World", "Hello World")).toBe(1.0);
  });

  it("returns 0.0 for completely different titles", () => {
    expect(wordOverlapRatio("Apple Banana", "Cherry Date")).toBe(0.0);
  });

  it("returns partial overlap correctly", () => {
    const ratio = wordOverlapRatio(
      "Apple releases new iPhone",
      "Apple announces new iPhone model"
    );
    expect(ratio).toBeGreaterThanOrEqual(0.5);
  });

  it("is case-insensitive", () => {
    expect(wordOverlapRatio("Hello World", "hello world")).toBe(1.0);
  });
});

describe("deduplicateArticles", () => {
  it("removes exact duplicate titles", () => {
    const articles = [
      makeArticle({ title: "Same Title", source: "Source A" }),
      makeArticle({ title: "Same Title", source: "Source B" }),
    ];
    const result = deduplicateArticles(articles);
    expect(result).toHaveLength(1);
  });

  it("removes fuzzy duplicates above threshold", () => {
    const articles = [
      makeArticle({ title: "Apple Releases New iPhone 15 Pro" }),
      makeArticle({ title: "Apple Releases the New iPhone 15 Pro Max" }),
    ];
    const result = deduplicateArticles(articles, 0.6);
    expect(result).toHaveLength(1);
  });

  it("keeps articles below similarity threshold", () => {
    const articles = [
      makeArticle({ title: "Apple Releases New iPhone" }),
      makeArticle({ title: "Google Announces Pixel Update" }),
    ];
    const result = deduplicateArticles(articles);
    expect(result).toHaveLength(2);
  });

  it("preserves order (first seen wins)", () => {
    const articles = [
      makeArticle({ title: "Same Story", source: "First Source" }),
      makeArticle({ title: "Same Story", source: "Second Source" }),
    ];
    const result = deduplicateArticles(articles);
    expect(result[0].source).toBe("First Source");
  });
});
