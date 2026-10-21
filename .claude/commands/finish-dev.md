---
allowed-tools: Bash(gh project item-list:*), Bash(gh project item-edit:*), Bash(gh project field-list:*), Bash(git branch:*), Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*)
description: Close out a dev session — run sensors, commit via the commit skill, move the issue to In Review
---

# finish-dev

1. Run the checks from `/sensor-and-fix` first (or tell the user to run it) — don't duplicate that logic here. All sensors should pass before committing.
2. Follow the `commit` skill's process: refuse on `main`, show diff, secret-scan, determine `WH-<n>` from the branch name, draft the message, stage by path, commit. Never `--no-verify`.
3. After a successful commit, find the GitHub issue matching the branch's `WH-<n>` — same lookup style as `kickoff.md`:
   - `gh project item-list {project-number} --owner {owner} --format json` to find the item for this issue and its item id.
   - `gh project field-list {project-number} --owner {owner} --format json` to resolve the Status field id and the "In Review" option id.
   - `gh project item-edit --id {item-id} --field-id {field-id} --project-id {project-id} --single-select-option-id {option-id}` to set it.
   - If project number/owner is unknown or ambiguous, use `AskUserQuestion`.
4. Report the commit hash and the new issue status. Do not push and do not open a PR — those are separate, explicit user actions.
