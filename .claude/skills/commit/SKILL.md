---
name: commit
description: Review staged/unstaged changes, draft a conventional commit message prefixed with the branch's WH-<n> issue id, confirm with the user, then commit (no push). Use for "commit this", "commit and push" (stop before push), or /commit. Supersedes the user-level safe-commit skill in this repo.
---

# commit

Commit current changes on a feature branch. Never push — this skill stops after `git commit`.

## 1. Refuse on `main`

Run `git branch --show-current`. If it prints `main`, stop and tell the user: commits must happen on a feature branch, not `main`. Do not proceed.

## 2. Show state

Run `git status --short` and `git diff` (plus `git diff --cached` if anything is already staged). Summarize the diff briefly for the user — files touched and the gist of the change, not a line-by-line dump.

## 3. Secret scan

Before staging, scan the diff for secrets:

```
git diff | grep -iE 'github_pat_|ghp_[A-Za-z0-9]{10}|sk-[A-Za-z0-9]{10}|api[_-]?key|password=|secret='
```

If anything matches, stop and flag it to the user instead of committing. Also check `git status` for suspicious untracked files (`.env`, `*.pem`, `credentials*`) before staging them.

## 4. Determine the issue id

Run `git branch --show-current` and look for a `WH-<n>` pattern in the branch name (e.g. `feature/WH-2-waitlist` → `WH-2`). Case-insensitive match, normalize to uppercase `WH-<n>`.

If no `WH-<n>` is found in the branch name, ask the user for the issue id (AskUserQuestion or a direct question) before drafting the message. Do not guess or invent one.

## 5. Draft the commit message

Conventional Commits format, issue id prefixed after the type/scope:

```
<type>(<scope>): WH-<n> <short summary>

<body explaining why, if non-trivial>
```

- `type` from the diff: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, etc.
- Keep the summary line short and in the imperative mood.
- Infer scope/body from the actual diff — don't template-fill generic text.

Show the drafted message to the user and ask for confirmation (or edits) before committing. Do not commit without explicit confirmation.

## 6. Stage

Stage only the files relevant to this change, by path (`git add <path> <path>`). Never use `git add -A` or `git add .` blindly — re-check `git status` after staging to confirm nothing unintended (stray `.env`, unrelated files from other work) got included.

## 7. Commit

Run `git commit -m "<confirmed message>"`. Never pass `--no-verify`. If a pre-commit hook fails, fix the underlying issue, re-stage, and commit again as a new commit — do not bypass the hook.

## 8. Stop

After a successful commit, report the commit hash/summary and stop. Do not run `git push`, even if the user's original request mentioned "commit and push" — only push if the user separately confirms/asks after seeing the commit.
