import { createHash } from "node:crypto";
import type { NormalizedArticle, UniqueArticle } from "../types.js";

export function hashTitle(title: string): string {
  const normalized = title.toLowerCase().replace(/[^\w\s]/g, "").trim();
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

export function wordOverlapRatio(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));

  if (wordsA.size === 0 && wordsB.size === 0) return 1.0;
  if (wordsA.size === 0 || wordsB.size === 0) return 0.0;

  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  return overlap / union;
}

export function deduplicateArticles(
  articles: NormalizedArticle[],
  similarityThreshold = 0.7
): UniqueArticle[] {
  const seen: UniqueArticle[] = [];

  for (const article of articles) {
    const hash = hashTitle(article.title);

    // Check for exact hash match
    if (seen.some((s) => s.hash === hash)) continue;

    // Check for fuzzy match
    const isFuzzyDup = seen.some(
      (s) => wordOverlapRatio(s.title, article.title) >= similarityThreshold
    );
    if (isFuzzyDup) continue;

    seen.push({ ...article, hash });
  }

  return seen;
}

export function filterSeenArticles(
  articles: UniqueArticle[],
  seenHashes: Set<string>
): UniqueArticle[] {
  return articles.filter((a) => !seenHashes.has(a.hash));
}
