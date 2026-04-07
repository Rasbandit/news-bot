import type { OutputPlugin } from "./plugin.js";
import type { DigestResult, ScoredArticle } from "../types.js";

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
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
  tech: 0x5865f2,
  world: 0x57f287,
  science: 0xfee75c,
  business: 0xeb459e,
};

export function createDiscordPlugin(
  webhookUrl: string,
  maxEmbedsPerMessage = 10
): OutputPlugin {
  return {
    name: "discord",
    enabled: true,
    async send(digest: DigestResult) {
      const embeds = buildCompactEmbeds(digest);

      for (let i = 0; i < embeds.length; i += maxEmbedsPerMessage) {
        const batch = embeds.slice(i, i + maxEmbedsPerMessage);
        const isFirst = i === 0;

        const payload: DiscordWebhookPayload = {
          ...(isFirst && {
            content: `\u{1F4F0} **Daily Digest** \u2014 ${formatDate(digest.generatedAt)}`,
          }),
          embeds: batch,
        };

        await sendWebhook(webhookUrl, payload);

        if (i + maxEmbedsPerMessage < embeds.length) {
          await sleep(1000);
        }
      }
    },
  };
}

function buildCompactEmbeds(digest: DigestResult): DiscordEmbed[] {
  const grouped = groupByCategory(digest.articles);
  const embeds: DiscordEmbed[] = [];

  for (const [category, articles] of Object.entries(grouped)) {
    const emoji = CATEGORY_EMOJI[category] ?? "\u{1F4CB}";
    const color = CATEGORY_COLOR[category] ?? 0x99aab5;

    // One embed per category — all articles packed into description
    const lines = articles.map((a) => formatArticleLine(a));
    const description = lines.join("\n\n");

    // Discord embed description limit is 4096 chars
    embeds.push({
      title: `${emoji} ${category.toUpperCase()}`,
      description: description.slice(0, 4096),
      color,
    });
  }

  return embeds;
}

function formatArticleLine(article: ScoredArticle): string {
  return `**[${article.title}](${article.link})** \u2014 *${article.source}*\n${article.summary}`;
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
