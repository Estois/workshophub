#!/usr/bin/env bash
# Writes .claude/settings.local.json pointing Claude Code at the gateway.
set -euo pipefail

command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }

read -rsp "Paste your gateway key: " KEY; echo
[ -n "$KEY" ] || { echo "No key entered" >&2; exit 1; }

mkdir -p .claude
umask 077  # file is created 600 from the start, no world-readable window

jq -n --arg k "$KEY" '{
  env: {
    ANTHROPIC_BASE_URL: "https://api.dsta.polis.thoughtworks-labs.net",
    ANTHROPIC_AUTH_TOKEN: $k,
    ANTHROPIC_MODEL: "anthropic/claude-sonnet-5",
    ANTHROPIC_DEFAULT_SONNET_MODEL: "anthropic/claude-sonnet-5",
    ANTHROPIC_DEFAULT_HAIKU_MODEL: "anthropic/claude-haiku-4-5",
    ANTHROPIC_SMALL_FAST_MODEL: "anthropic/claude-haiku-4-5",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: "1",
    CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: "1",
    MAX_THINKING_TOKENS: "0"
  }
}' > .claude/settings.local.json
unset KEY
chmod 600 .claude/settings.local.json

# Add to .gitignore only once
touch .gitignore
grep -qxF '.claude/settings.local.json' .gitignore \
  || printf '.claude/settings.local.json\n' >> .gitignore

echo "Wrote .claude/settings.local.json"
