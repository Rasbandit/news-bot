import { loadFeedsConfig, loadPromptsConfig } from "./config.js";
import { fetchAllFeeds } from "./pipeline/fetch.js";
import { normalizeArticles } from "./pipeline/normalize.js";
import { scoreArticles } from "./pipeline/scorer.js";

async function main() {
  const feedsConfig = loadFeedsConfig();
  const promptsConfig = loadPromptsConfig();

  // Fetch from a small subset for PoC
  const pocConfig = {
    ...feedsConfig,
    categories: {
      tech: {
        ...feedsConfig.categories.tech,
        feeds: feedsConfig.categories.tech.feeds.slice(0, 2),
      },
    },
  };

  console.log("Fetching feeds...");
  const raw = await fetchAllFeeds(pocConfig);
  const normalized = normalizeArticles(raw, feedsConfig.settings.max_article_age_hours);
  console.log(`${normalized.length} articles to score\n`);

  console.log("Scoring with claude -p...");
  const scored = await scoreArticles(normalized, {
    systemPrompt: promptsConfig.scorer.system,
    userTemplate: promptsConfig.scorer.user_template,
    targetDigestSize: 5, // small for PoC
  });

  console.log(`\nTop ${scored.length} articles:\n`);
  for (const article of scored) {
    const toneEmoji =
      article.tone === "positive" ? "+" : article.tone === "negative" ? "-" : "~";
    console.log(`[${article.score}/10] [${toneEmoji}] ${article.title}`);
    console.log(`  ${article.source} | ${article.category}`);
    console.log(`  ${article.summary}\n`);
  }
}

main().catch(console.error);
