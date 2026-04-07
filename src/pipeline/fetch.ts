import RssParser from "rss-parser";
import type { FeedsConfig, RawArticle } from "../types.js";

const parser = new RssParser({
  timeout: 10_000,
});

export async function fetchAllFeeds(config: FeedsConfig): Promise<RawArticle[]> {
  const allArticles: RawArticle[] = [];
  const { max_articles_per_feed } = config.settings;

  const feedTasks = Object.entries(config.categories).flatMap(
    ([category, categoryConfig]) =>
      categoryConfig.feeds.map((feed) => ({
        feed,
        category,
      }))
  );

  const results = await Promise.allSettled(
    feedTasks.map(async ({ feed, category }) => {
      const parsed = await parser.parseURL(feed.url);
      return parsed.items.slice(0, max_articles_per_feed).map(
        (item): RawArticle => ({
          title: item.title ?? "(no title)",
          description: item.contentSnippet ?? item.content ?? "",
          link: item.link ?? "",
          publishedAt: item.pubDate ? new Date(item.pubDate) : null,
          source: feed.name,
          category,
        })
      );
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      allArticles.push(...result.value);
    } else {
      console.warn(`Feed fetch failed: ${result.reason}`);
    }
  }

  return allArticles;
}
