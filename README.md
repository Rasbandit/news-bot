# news-bot

A daily news digest that reads like a friend picked the stories. It pulls RSS feeds, drops duplicates, has Claude pick the handful worth reading, and posts them to Discord every morning.

It leans toward pragmatic, useful news (tech, self-hosting, security, science, a little world news) and away from doom and outrage.

## How it works

```
RSS feeds ─► normalize ─► dedup (SQLite) ─► Claude scores + summarizes ─► Discord
```

1. **Fetch** every feed in `config/feeds.yaml` (weighted by category and by source).
2. **Normalize** titles and HTML, and drop anything older than 24 hours.
3. **Dedup** against a local SQLite history (title hash + fuzzy title match), so a story never posts twice.
4. **Score** the candidates with `claude -p` using the rules in `config/prompts.yaml`: one-sentence summaries, per-category caps, quality over quantity.
5. **Post** the digest to a Discord webhook as compact embeds.

A systemd user timer runs it once a day at 7am.

## Setup

Requires Node 22+ and the [Claude Code](https://claude.com/claude-code) CLI (`claude`), logged in.

```bash
npm install
cp .env.example .env        # add your Discord webhook URL
npx tsx src/index.ts run --dry-run   # fetch + score, print instead of posting
npx tsx src/index.ts run             # post to Discord
```

Run it daily:

```bash
./scripts/install-timer.sh
journalctl --user -u news-bot.service -f
```

## Configure

| File | What it controls |
|---|---|
| `config/feeds.yaml` | Feeds, category weights, digest size, max article age |
| `config/prompts.yaml` | How Claude picks and summarizes stories |
| `config/outputs.yaml` | Where the digest goes (Discord today; outputs are plugins) |

## Tests

```bash
npm test
```

## License

MIT
