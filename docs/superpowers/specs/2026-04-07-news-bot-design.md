# News Bot — Daily News Aggregator Design

## Context

Build a personal daily news aggregator that curates technology-focused content with balanced world/USA coverage. The system should prioritize pragmatic, positive news over dread-inducing content while keeping API/token costs minimal. Output goes to Discord via webhook.

**Key constraints from user:**
- Easily extensible — new sources, new output targets, new categories added without code changes
- Highly configurable — weights, filters, prompts, schedules all in config files
- Token-efficient — minimize Anthropic API costs
- Proof of concept first — validate each pipeline stage works before building the full system

## Architecture: RSS Funnel

```
Feeds Config (YAML)
       │
       ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────────┐    ┌──────────────┐
│ 1. Fetch    │───▶│ 2. Normalize │───▶│ 3. Deduplicate  │───▶│ 4. LLM Score │───▶│ 5. Output    │
│    RSS      │    │    & Clean   │    │    & Filter      │    │    & Digest   │    │   (plugins)  │
└─────────────┘    └──────────────┘    └─────────────────┘    └──────────────┘    └──────────────┘
```

Each stage is a pure function: takes data in, returns data out. Stages are composable and independently testable.

## Data Sources

### Initial Feed Set

**Tech (~70%):**
| Feed | URL | Notes |
|------|-----|-------|
| Hacker News (best) | `https://hnrss.org/best` | Community-curated, high signal |
| Ars Technica | `https://feeds.arstechnica.com/arstechnica/index` | Deep tech journalism |
| Lobsters | `https://lobste.rs/rss` | Dev/systems-focused |
| TechCrunch | `https://techcrunch.com/feed/` | Startup/industry |
| The Verge | `https://www.theverge.com/rss/index.xml` | Consumer tech |

**World/USA (~30%):**
| Feed | URL | Notes |
|------|-----|-------|
| AP News | `https://rsshub.app/apnews/topics/apf-topnews` | Wire service, factual. Uses RSSHub (may need self-hosted fallback) |
| Reuters | `https://rsshub.app/reuters/world` | Wire service, balanced. Uses RSSHub (may need self-hosted fallback) |
| NPR | `https://feeds.npr.org/1001/rss.xml` | US public radio |
| BBC World | `https://feeds.bbci.co.uk/news/world/rss.xml` | International perspective |

### Extensibility: Feed Config

`config/feeds.yaml` — add/remove feeds without code changes:

```yaml
settings:
  max_articles_per_feed: 25
  max_article_age_hours: 24
  target_digest_size: 15

categories:
  tech:
    weight: 0.7  # 70% of digest
    feeds:
      - name: Hacker News
        url: https://hnrss.org/best
        weight: 1.2
      - name: Ars Technica
        url: https://feeds.arstechnica.com/arstechnica/index
        weight: 1.0
      - name: Lobsters
        url: https://lobste.rs/rss
        weight: 1.0
      - name: TechCrunch
        url: https://techcrunch.com/feed/
        weight: 0.8
      - name: The Verge
        url: https://www.theverge.com/rss/index.xml
        weight: 0.8

  world:
    weight: 0.3  # 30% of digest
    feeds:
      - name: AP News
        url: https://rsshub.app/apnews/topics/apf-topnews
        weight: 1.0
      - name: Reuters
        url: https://rsshub.app/reuters/world
        weight: 1.0
      - name: NPR
        url: https://feeds.npr.org/1001/rss.xml
        weight: 0.9
      - name: BBC World
        url: https://feeds.bbci.co.uk/news/world/rss.xml
        weight: 0.9
```

**Adding a new category** (e.g., `science`, `gaming`) = add a new key under `categories` with feeds and weight. The pipeline handles it automatically.

## Pipeline Stages (Detail)

### Stage 1: Fetch RSS

- Parse all feeds concurrently using `rss-parser`
- Respect `max_articles_per_feed` limit
- Timeout per feed: 10s (don't let one slow feed block everything)
- On feed failure: log warning, continue with other feeds
- Returns: `RawArticle[]`

### Stage 2: Normalize & Clean

- Extract: `title`, `description`, `link`, `publishedAt`, `source`, `category`
- Strip HTML tags from descriptions
- Truncate descriptions to ~200 chars (enough for LLM context, saves tokens)
- Filter out articles older than `max_article_age_hours`
- Returns: `NormalizedArticle[]`

### Stage 3: Deduplicate & Filter

- Generate hash from normalized title (lowercase, strip punctuation)
- Fuzzy-match similar titles across sources using word overlap ratio (simple, fast, no extra dependency)
- Check against SQLite `seen_articles` table — skip already-posted items
- Returns: `UniqueArticle[]`

### Stage 4: LLM Score & Digest

**Single batched API call** to Claude Haiku with all article titles + descriptions.

Prompt template (configurable in `config/prompts.yaml`):

```
You are a news curator for a technology-focused daily digest. 
Your reader prefers pragmatic, balanced, and interesting news. 
Deprioritize doom, outrage, and fear-based content. 
Still include important negative news if it's genuinely significant.

Here are today's articles:
{articles_json}

Select the top {target_digest_size} articles. For each, return:
- id (from input)
- score (0-10, relevance + interest)
- tone (positive/neutral/negative)  
- summary (1-2 sentences, informative and concise)
- category_override (if the article fits a different category better)

Return as JSON array sorted by score descending.
```

**Token budget per run:**
- Input: ~3000-5000 tokens (80-100 articles × 40-60 tokens each)
- Output: ~1500-2000 tokens (15 articles × 100-130 tokens each)
- Haiku cost: ~$0.001-0.003 per run

**Prompt extensibility:** Prompts live in `config/prompts.yaml`. Users can tune the persona, tone preferences, and output format without touching code.

### Stage 5: Output (Plugin System)

Output is plugin-based for extensibility:

```typescript
interface OutputPlugin {
  name: string;
  enabled: boolean;
  send(digest: DigestResult): Promise<void>;
}
```

**Initial plugin:** Discord webhook
- Format articles as Discord embeds grouped by category
- Respect Discord's 6000-char embed limit (split into multiple messages if needed)
- Include metadata footer: article count, sources, run timestamp

**Future plugins** (just implement the interface):
- Email (nodemailer)
- Markdown file (write to disk / Obsidian vault)
- Slack webhook
- Telegram bot

Output plugins configured in `config/outputs.yaml`:

```yaml
outputs:
  discord:
    enabled: true
    webhook_url: ${DISCORD_WEBHOOK_URL}
    max_embeds_per_message: 10
  # markdown:
  #   enabled: false
  #   output_dir: ~/Documents/Obsidian/Personal/news/
```

## Storage

**SQLite** via `better-sqlite3` (synchronous, zero-config):

```sql
CREATE TABLE seen_articles (
  hash TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  posted_at INTEGER NOT NULL
);

-- Auto-prune: DELETE WHERE posted_at < (now - 7 days)
```

DB file location: `data/news-bot.db` (gitignored)

## Project Structure

```
news-bot/
├── src/
│   ├── index.ts              # Entry point, CLI, orchestrator
│   ├── config.ts             # Load & validate YAML configs
│   ├── pipeline/
│   │   ├── fetch.ts          # Stage 1: RSS fetching
│   │   ├── normalize.ts      # Stage 2: Clean & normalize
│   │   ├── dedup.ts          # Stage 3: Deduplicate + seen check
│   │   └── scorer.ts         # Stage 4: LLM scoring & summarization
│   ├── outputs/
│   │   ├── plugin.ts         # Output plugin interface
│   │   └── discord.ts        # Discord webhook plugin
│   ├── db.ts                 # SQLite operations
│   └── types.ts              # Shared type definitions
├── config/
│   ├── feeds.yaml            # Feed sources & categories
│   ├── prompts.yaml          # LLM prompt templates
│   └── outputs.yaml          # Output plugin config
├── data/                     # SQLite DB (gitignored)
├── package.json
├── tsconfig.json
├── .env                      # ANTHROPIC_API_KEY, DISCORD_WEBHOOK_URL
└── .env.example
```

## CLI Interface

```bash
# Run the full pipeline (daily digest)
npx news-bot

# Run on-demand (same pipeline, just triggered manually)
npx news-bot --run

# Dry run — fetch & score but don't post to Discord
npx news-bot --dry-run

# Show what feeds are configured
npx news-bot --list-feeds
```

## Systemd Timer

```ini
# ~/.config/systemd/user/news-bot.timer
[Unit]
Description=Daily news digest

[Timer]
OnCalendar=*-*-* 07:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

## Extensibility Summary

| What | How to extend | Where |
|------|--------------|-------|
| Add news source | Add entry to YAML | `config/feeds.yaml` |
| Add category | Add category key + feeds | `config/feeds.yaml` |
| Change tone/persona | Edit prompt template | `config/prompts.yaml` |
| Add output target | Implement `OutputPlugin` interface | `src/outputs/` |
| Change digest size | Edit `target_digest_size` | `config/feeds.yaml` |
| Adjust source priority | Change `weight` values | `config/feeds.yaml` |

## Proof of Concept Plan

Before building the full system, validate each stage independently:

### PoC 1: RSS Fetching
- Fetch 2-3 feeds, parse them, print normalized output
- Validates: feed URLs work, parser handles different RSS formats

### PoC 2: LLM Scoring
- Take hardcoded sample articles, send to Haiku, verify JSON response
- Validates: prompt produces usable structured output, tone filtering works

### PoC 3: Discord Output
- Send a formatted test message to the webhook
- Validates: embed formatting, character limits, grouping

### PoC 4: End-to-End
- Wire PoCs together, run full pipeline with dry-run
- Validates: data flows correctly between stages

## Testing Strategy

- Unit tests for each pipeline stage (pure functions, easy to test)
- Integration test: full pipeline with mocked LLM responses
- E2E test: `--dry-run` flag that runs everything but skips Discord post

## Dependencies

| Package | Purpose |
|---------|---------|
| `rss-parser` | RSS/Atom feed parsing |
| `@anthropic-ai/sdk` | Claude API client |
| `better-sqlite3` | SQLite driver |
| `yaml` | Config file parsing |
| `sanitize-html` | Strip HTML from descriptions |
| `commander` | CLI argument parsing |

## Cost Estimate

- ~1 Haiku API call per digest run
- ~5000 input tokens + ~2000 output tokens per run
- At Haiku pricing ($0.25/M input, $1.25/M output): **~$0.004/run**
- Daily cost: **< $0.01/day**, Monthly: **< $0.15/month**
