import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { NormalizedArticle, ScoredArticle } from "../types.js";

const execFileAsync = promisify(execFile);

interface ScorerConfig {
  systemPrompt: string;
  userTemplate: string;
  targetDigestSize: number;
}

interface LlmScoredItem {
  id: number;
  score: number;
  tone: "positive" | "neutral" | "negative";
  summary: string;
}

export async function scoreArticles(
  articles: NormalizedArticle[],
  config: ScorerConfig
): Promise<ScoredArticle[]> {
  const articlesForLlm = articles.map((a, i) => ({
    id: i,
    title: a.title,
    description: a.description,
    source: a.source,
    category: a.category,
  }));

  const userPrompt = config.userTemplate
    .replace("{articles_json}", JSON.stringify(articlesForLlm))
    .replace("{target_digest_size}", String(config.targetDigestSize));

  const fullPrompt = `${config.systemPrompt}\n\n${userPrompt}`;

  const { stdout } = await execFileAsync("claude", ["-p", fullPrompt], {
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
  });

  const scored = parseResponse(stdout.trim());

  return scored.map((item) => {
    const original = articles[item.id];
    return {
      id: item.id,
      title: original.title,
      link: original.link,
      source: original.source,
      category: original.category,
      score: item.score,
      tone: item.tone,
      summary: item.summary,
    };
  });
}

function parseResponse(response: string): LlmScoredItem[] {
  // Extract JSON array from response — LLM might wrap it in markdown code fences
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`Failed to parse LLM response as JSON array: ${response.slice(0, 200)}`);
  }
  return JSON.parse(jsonMatch[0]);
}
