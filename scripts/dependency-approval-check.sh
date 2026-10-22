#!/usr/bin/env bash
set -euo pipefail

# Used by the Approvals PreToolUse hook. Flags Bash commands that add a new
# dependency (pnpm add / npm install <pkg> / yarn add) so Claude Code's own
# permission prompt requires explicit user confirmation, rather than
# silently installing a new package via an allowlisted Bash pattern.
CMD="${1:-}"

# Anchor to actual command positions (start of string, or after &&/;/|/newline)
# so this doesn't false-positive on the phrase appearing in a heredoc, commit
# message, or comment embedded in the same Bash invocation.
if echo "$CMD" | grep -qE '(^|[;&|]|&&|\n)[[:space:]]*(pnpm|npm|yarn)[[:space:]]+add([[:space:]]|$)' \
  || echo "$CMD" | grep -qE '(^|[;&|]|&&|\n)[[:space:]]*npm[[:space:]]+install[[:space:]]+[^-[:space:]]'; then
  echo "Dependency addition detected: '$CMD' — requires explicit user confirmation." >&2
  exit 2
fi

exit 0
