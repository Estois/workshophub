---
allowed-tools: AskUserQuestion, Bash(gh issue view:*), Bash(gh issue comment:*), Bash(gh issue develop:*), Bash(gh project item-list:*), Bash(gh project item-edit:*), Bash(gh project field-list:*), Bash(git checkout:*), Bash(git branch:*)
description: Kick off work on an issue — move to In Progress (or comment if already there), save story, create branch
---

# kickoff

Argument: issue id/number, e.g. `/kickoff 42`.

1. Read the issue: `gh issue view {id} --json number,title,body,url,state`.
2. Find the issue's Projects (v2) status:
   - `gh project item-list {project-number} --owner {owner} --format json` to locate the item for this issue and its current `Status` field value.
   - If project number/owner is unknown or ambiguous, use `AskUserQuestion` to ask which project to check.
3. Check status:
   - If not already `In Progress`: resolve the Status field and "In Progress" option id with `gh project field-list {project-number} --owner {owner} --format json`, then set it with `gh project item-edit --id {item-id} --field-id {field-id} --project-id {project-id} --single-select-option-id {option-id}`.
   - If already `In Progress`: leave a comment instead via `gh issue comment {id} --body "..."` noting this new attempt. Do not transition it.
4. Use `AskUserQuestion` for anything ambiguous (missing id, unclear scope, multiple matching issues, unresolvable project/field ids).
5. Save the issue content as a story markdown file under `./stories` (e.g. `./stories/WH-{id}.md`).
6. Derive a short kebab-case description from the issue title: `wh-{id}-{desc}`.
7. Create the branch via `gh issue develop {id} --name wh-{id}-{desc} --checkout` — this both links the branch to the issue's Development panel and checks it out locally in one step. **Do not** pre-create the branch with `git checkout -b` first: `gh issue develop` creates the remote branch itself, and calling it against a branch name that already exists (locally or on `origin`) fails with "API returned empty branch name". If the branch already exists for some other reason, delete it first (`git branch -D wh-{id}-{desc}`, `git push origin --delete wh-{id}-{desc}` if pushed) and retry.
8. Confirm the branch name to the user and stop. Do not start implementation.
