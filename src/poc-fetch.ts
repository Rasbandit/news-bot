import { loadFeedsConfig } from "./config.js";
import { fetchAllFeeds } from "./pipeline/fetch.js";
import { normalizeArticles } from "./pipeline/normalize.js";

async function main() {
  console.log("Loading config...");
  const config = loadFeedsConfig();

  // PoC: only fetch 2 feeds to keep it quick
  const pocConfig = {
    ...config,
    categories: {
      tech: {
        ...config.categories.tech,
        feeds: config.categories.tech.feeds.slice(0, 2), // HN + Ars
      },
      world: {
        ...config.categories.world,
        feeds: config.categories.world.feeds.slice(2, 3), // NPR only
      },
    },
  };

  console.log("Fetching feeds...");
  const raw = await fetchAllFeeds(pocConfig);
  console.log(`Fetched ${raw.length} raw articles`);

  const normalized = normalizeArticles(raw, config.settings.max_article_age_hours);
  console.log(`Normalized to ${normalized.length} articles (after age filter)\n`);

  // Show a sample
  for (const article of normalized.slice(0, 5)) {
    console.log(`[${article.category}] ${article.source}`);
    console.log(`  ${article.title}`);
    console.log(`  ${article.description.slice(0, 100)}...`);
    console.log(`  ${article.link}\n`);
  }
}

main().catch(console.error);
