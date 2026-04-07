import "dotenv/config";
import { Command } from "commander";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { loadFeedsConfig, loadPromptsConfig, loadOutputsConfig, formatInterests } from "./config.js";
import { fetchAllFeeds } from "./pipeline/fetch.js";
import { normalizeArticles } from "./pipeline/normalize.js";
import { deduplicateArticles, filterSeenArticles } from "./pipeline/dedup.js";
import { scoreArticles } from "./pipeline/scorer.js";
import { createDiscordPlugin } from "./outputs/discord.js";
import { createDb } from "./db.js";
import type { DigestResult } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/news-bot.db");

async function runPipeline(options: { dryRun: boolean }) {
  const feedsConfig = loadFeedsConfig();
  const promptsConfig = loadPromptsConfig();
  const outputsConfig = loadOutputsConfig();

  // Stage 1: Fetch
  console.log("Fetching RSS feeds...");
  const raw = await fetchAllFeeds(feedsConfig);
  console.log(`  Fetched ${raw.length} articles from ${countSources(feedsConfig)} sources`);

  // Stage 2: Normalize
  const normalized = normalizeArticles(raw, feedsConfig.settings.max_article_age_hours);
  console.log(`  ${normalized.length} articles after age filter`);

  // Stage 3: Deduplicate
  const unique = deduplicateArticles(normalized);
  console.log(`  ${unique.length} unique articles after dedup`);

  // Filter already-seen articles
  const db = createDb(DB_PATH);
  try {
    db.prune(7);
    const seenHashes = db.getSeenHashes();
    const fresh = filterSeenArticles(unique, seenHashes);
    console.log(`  ${fresh.length} new articles (${seenHashes.size} previously seen)`);

    if (fresh.length === 0) {
      console.log("No new articles to process. Done.");
      return;
    }

    // Stage 4: LLM Score & Summarize
    console.log("\nScoring articles with LLM...");
    const scored = await scoreArticles(fresh, {
      systemPrompt: promptsConfig.scorer.system,
      userTemplate: promptsConfig.scorer.user_template,
      targetDigestSize: feedsConfig.settings.target_digest_size,
      interests: formatInterests(promptsConfig.interests),
    });
    console.log(`  Selected top ${scored.length} articles`);

    const digest: DigestResult = {
      articles: scored,
      generatedAt: new Date(),
      sourceCount: countSources(feedsConfig),
      totalFetched: raw.length,
    };

    // Stage 5: Output
    if (options.dryRun) {
      console.log("\n--- DRY RUN (not posting) ---\n");
      printDigest(digest);
    } else {
      const discordConfig = outputsConfig.outputs.discord;
      if (discordConfig.enabled && discordConfig.webhook_url) {
        console.log("\nPosting to Discord...");
        const discord = createDiscordPlugin(
          discordConfig.webhook_url,
          discordConfig.max_embeds_per_message
        );
        await discord.send(digest);
        console.log("  Posted to Discord.");
      }
    }

    // Mark all scored articles as seen
    for (const article of scored) {
      const original = fresh.find((a) => a.title === article.title);
      if (original) {
        db.markSeen(original.hash, article.link, article.title, article.source);
      }
    }

    console.log("\nDone.");
  } finally {
    db.close();
  }
}

function printDigest(digest: DigestResult) {
  for (const article of digest.articles) {
    const toneChar =
      article.tone === "positive" ? "+" : article.tone === "negative" ? "-" : "~";
    console.log(`[${article.score}/10] [${toneChar}] ${article.title}`);
    console.log(`  ${article.source} | ${article.category}`);
    console.log(`  ${article.summary}`);
    console.log(`  ${article.link}\n`);
  }
  console.log(
    `${digest.articles.length} stories from ${digest.sourceCount} sources (${digest.totalFetched} scanned)`
  );
}

function countSources(config: ReturnType<typeof loadFeedsConfig>): number {
  return Object.values(config.categories).reduce(
    (sum, cat) => sum + cat.feeds.length,
    0
  );
}

function listFeeds() {
  const config = loadFeedsConfig();
  for (const [category, catConfig] of Object.entries(config.categories)) {
    console.log(`\n${category.toUpperCase()} (weight: ${catConfig.weight})`);
    for (const feed of catConfig.feeds) {
      console.log(`  ${feed.name} (weight: ${feed.weight ?? 1.0})`);
      console.log(`    ${feed.url}`);
    }
  }
}

const program = new Command()
  .name("news-bot")
  .description("Daily news aggregator with LLM curation")
  .version("1.0.0");

program
  .command("run", { isDefault: true })
  .description("Run the news digest pipeline")
  .option("--dry-run", "Fetch and score but don't post to Discord", false)
  .action((opts) => runPipeline(opts));

program
  .command("feeds")
  .description("List configured feeds")
  .action(listFeeds);

program.parse();
