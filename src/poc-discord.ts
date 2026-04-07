import "dotenv/config";
import { createDiscordPlugin } from "./outputs/discord.js";
import type { DigestResult } from "./types.js";

async function main() {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("DISCORD_WEBHOOK_URL not set in .env");
    process.exit(1);
  }

  const testDigest: DigestResult = {
    generatedAt: new Date(),
    sourceCount: 3,
    totalFetched: 55,
    articles: [
      {
        id: 0,
        title: "Rust 2026 Edition Released with Async Generators",
        link: "https://example.com/rust-2026",
        source: "Ars Technica",
        category: "tech",
        score: 9,
        tone: "positive",
        summary:
          "New borrow checker improvements and async generators land in stable Rust. A significant milestone for the language ecosystem.",
      },
      {
        id: 1,
        title: "Open Source LLM Achieves GPT-4 Level Reasoning",
        link: "https://example.com/open-llm",
        source: "Hacker News",
        category: "tech",
        score: 8,
        tone: "positive",
        summary:
          "A community-driven open source model matches GPT-4 on key benchmarks while running on consumer hardware.",
      },
      {
        id: 2,
        title: "EU Reaches Historic Trade Agreement",
        link: "https://example.com/eu-trade",
        source: "Reuters",
        category: "world",
        score: 7,
        tone: "neutral",
        summary:
          "The European Union and Mercosur finalize a comprehensive trade deal after decades of negotiations.",
      },
    ],
  };

  console.log("Sending test digest to Discord...");
  const plugin = createDiscordPlugin(webhookUrl);
  await plugin.send(testDigest);
  console.log("Sent! Check your Discord channel.");
}

main().catch(console.error);
