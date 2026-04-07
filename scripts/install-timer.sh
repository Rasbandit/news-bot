#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SYSTEMD_DIR="$HOME/.config/systemd/user"

mkdir -p "$SYSTEMD_DIR"

cp "$PROJECT_DIR/systemd/news-bot.service" "$SYSTEMD_DIR/"
cp "$PROJECT_DIR/systemd/news-bot.timer" "$SYSTEMD_DIR/"

systemctl --user daemon-reload
systemctl --user enable --now news-bot.timer

echo "Timer installed and enabled."
echo "Next run: $(systemctl --user list-timers news-bot.timer --no-pager | tail -2 | head -1)"
echo ""
echo "Useful commands:"
echo "  systemctl --user status news-bot.timer    # check timer status"
echo "  systemctl --user start news-bot.service    # trigger manually"
echo "  journalctl --user -u news-bot.service -f   # watch logs"
