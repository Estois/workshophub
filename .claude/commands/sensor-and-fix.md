---
allowed-tools: Bash(make lint:*), Bash(make format-check:*), Bash(make test:*), Bash(bash scripts/reasons-lint.sh:*), Bash(bash scripts/branch-name-check.sh:*), Bash(app/node_modules/.bin/prettier:*), Bash(api/node_modules/.bin/prettier:*), Bash(git diff:*), Bash(git status:*)
description: Run all sensors, auto-fix what's safely fixable, report what still needs attention
---

# sensor-and-fix

1. Run `make lint`. ESLint errors need human judgment (no `any`, etc. per repo norms) — do not auto-fix; report failures.
2. Run `make format-check`. If it fails, auto-fix by running the project's own prettier binaries (`app/node_modules/.bin/prettier --write` / `api/node_modules/.bin/prettier --write`) on the changed files — same as the existing `PostToolUse` hook already does on every Write/Edit.
3. Run `bash scripts/reasons-lint.sh` and `bash scripts/branch-name-check.sh`. Neither is auto-fixable — a failure means writing the missing canvas section or renaming the branch. Report failures as-is.
4. Run `make test`. Do not attempt to auto-fix test failures — that's a judgment call, not mechanical. Report failures.
5. Summarize: what passed, what was auto-fixed, what still needs manual attention.
