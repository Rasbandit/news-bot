import sanitizeHtml from "sanitize-html";
import type { RawArticle, NormalizedArticle } from "../types.js";

export function normalizeArticles(
  articles: RawArticle[],
  maxAgeHours: number,
  maxDescriptionLength = 200
): NormalizedArticle[] {
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;

  return articles.flatMap((article) => {
    if (!article.publishedAt || article.publishedAt.getTime() < cutoff) {
      return [];
    }

    const description = truncate(
      sanitizeHtml(article.description, { allowedTags: [], allowedAttributes: {} }),
      maxDescriptionLength
    );

    return [
      {
        title: article.title,
        description,
        link: article.link,
        publishedAt: article.publishedAt,
        source: article.source,
        category: article.category,
      },
    ];
  });
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}
