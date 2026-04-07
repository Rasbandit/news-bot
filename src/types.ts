export interface FeedSource {
  name: string;
  url: string;
  weight?: number;
}

export interface CategoryConfig {
  weight: number;
  feeds: FeedSource[];
}

export interface FeedsSettings {
  max_articles_per_feed: number;
  max_article_age_hours: number;
  target_digest_size: number;
}

export interface FeedsConfig {
  settings: FeedsSettings;
  categories: Record<string, CategoryConfig>;
}

export interface InterestsConfig {
  boost: string[];
  deprioritize: string[];
}

export interface PromptConfig {
  scorer: {
    system: string;
    user_template: string;
  };
  interests: InterestsConfig;
}

export interface DiscordOutputConfig {
  enabled: boolean;
  webhook_url: string;
  max_embeds_per_message: number;
}

export interface OutputsConfig {
  outputs: {
    discord: DiscordOutputConfig;
  };
}

export interface RawArticle {
  title: string;
  description: string;
  link: string;
  publishedAt: Date | null;
  source: string;
  category: string;
}

export interface NormalizedArticle {
  title: string;
  description: string;
  link: string;
  publishedAt: Date;
  source: string;
  category: string;
}

export interface UniqueArticle extends NormalizedArticle {
  hash: string;
}

export interface ScoredArticle {
  id: number;
  title: string;
  link: string;
  source: string;
  category: string;
  score: number;
  tone: "positive" | "neutral" | "negative";
  summary: string;
}

export interface DigestResult {
  articles: ScoredArticle[];
  generatedAt: Date;
  sourceCount: number;
  totalFetched: number;
}

export interface OutputPlugin {
  name: string;
  enabled: boolean;
  send(digest: DigestResult): Promise<void>;
}
