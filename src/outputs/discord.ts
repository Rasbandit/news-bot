import type { OutputPlugin } from "./plugin.js";
import type { DigestResult, ScoredArticle } from "../types.js";

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
}

interface DiscordWebhookPayload {
  content?: string;
  embeds?: DiscordEmbed[];
}

const CATEGORY_EMOJI: Record<string, string> = {
  tech: "\u{1F527}",
  world: "\u{1F30D}",
  science: "\u{1F52C}",
  business: "\u{1F4C8}",
};

const CATEGORY_COLOR: Record<string, number> = {
  tech: 0x5865f2, // blurple
  world: 0x57f287, // green
  science: 0xfee75c, // yellow
  business: 0xeb459e, // fuchsia
};

export function createDiscordPlugin(
  webhookUrl: string,
  maxEmbedsPerMessage = 10
): OutputPlugin {
  return {
    name: "discord",
    enabled: true,
    async send(digest: DigestResult) {
      const embeds = buildEmbeds(digest);

      // Discord allows max 10 embeds per message
      for (let i = 0; i < embeds.length; i += maxEmbedsPerMessage) {
        const batch = embeds.slice(i, i + maxEmbedsPerMessage);
        const isFirst = i === 0;

        const payload: DiscordWebhookPayload = {
          ...(isFirst && {
            content: `\u{1F4F0} **Daily Tech & World Digest** \u2014 ${formatDate(digest.generatedAt)}`,
          }),
          embeds: batch,
        };

        await sendWebhook(webhookUrl, payload);

        // Rate limit: small delay between messages
        if (i + maxEmbedsPerMessage < embeds.length) {
          await sleep(1000);
        }
      }
    },
  };
}

function buildEmbeds(digest: DigestResult): DiscordEmbed[] {
  const grouped = groupByCategory(digest.articles);
  const embeds: DiscordEmbed[] = [];

  for (const [category, articles] of Object.entries(grouped)) {
    const emoji = CATEGORY_EMOJI[category] ?? "\u{1F4CB}";
    const color = CATEGORY_COLOR[category] ?? 0x99aab5;

    // Category header embed
    embeds.push({
      title: `${emoji} ${category.toUpperCase()} (${articles.length})`,
      color,
    });

    // Article embeds
    for (const article of articles) {
      const toneIndicator =
        article.tone === "positive"
          ? "\u{2705}"
          : article.tone === "negative"
            ? "\u{1F7E1}"
            : "";

      embeds.push({
        description: [
          `**[${article.title}](${article.link})** \u2014 ${article.source} ${toneIndicator}`,
          article.summary,
        ].join("\n"),
        color,
      });
    }
  }

  // Footer embed
  embeds.push({
    footer: {
      text: `${digest.articles.length} stories from ${digest.sourceCount} sources | ${digest.totalFetched} total scanned`,
    },
    color: 0x2f3136,
  });

  return embeds;
}

function groupByCategory(
  articles: ScoredArticle[]
): Record<string, ScoredArticle[]> {
  const grouped: Record<string, ScoredArticle[]> = {};
  for (const article of articles) {
    (grouped[article.category] ??= []).push(article);
  }
  return grouped;
}

async function sendWebhook(
  url: string,
  payload: DiscordWebhookPayload
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord webhook failed (${response.status}): ${body}`);
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
