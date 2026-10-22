---
allowed-tools: Bash(git diff:*), Bash(git branch:*), Bash(ls spdd/prompt/*), Read
description: Active review rubric - checks the branch's REASONS canvas Safeguards against the current git diff
---

# safeguards-review

1. Find the current branch's canvas file(s) in `spdd/prompt/*.md` (use `ls`). If none exist, say so and stop — there's nothing to check against.
2. Read the canvas's `## Safeguards` section in full.
3. Run `git diff main...HEAD` (or `git diff --cached` if nothing is committed yet) to see the actual code changes.
4. For each Safeguards bullet, check whether the diff honors it:
   - **Honored**: the diff's behavior matches the constraint.
   - **Violated**: the diff does something the Safeguards bullet explicitly forbids or contradicts.
   - **Not yet addressed**: the Safeguards bullet implies something the diff doesn't touch at all (may be fine if out of scope for this commit, or may be a gap).
5. Report one line per Safeguards bullet: the bullet's gist, the verdict (Honored/Violated/Not yet addressed), and — for Violated or Not yet addressed — the specific file/line or omission that supports the verdict.
6. Do not edit any files. This is a read-only review — if violations are found, tell the user what needs fixing; let them (or a follow-up task) make the change.
