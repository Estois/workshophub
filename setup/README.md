# WorkshopHub Training — Setup & Cleanup

This folder contains scripts and prompts to help trainees set up and tear down their local training environment.

## Contents

| File                                | Purpose                                                        |
|-------------------------------------|----------------------------------------------------------------|
| `setup-prompt.md`                   | Claude Code prompt: fork base repo, install, build, verify     |
| `cleanup-prompt.md`                 | Claude Code prompt: optionally remove clone, fork, and Docker  |
| `install-prerequisites-mac.sh`      | macOS: install Node.js, pnpm, Docker tooling                   |
| `install-prerequisites-windows.ps1` | Windows: install Node.js, pnpm, Git, Rancher Desktop           |

Trainees **fork the base WorkshopHub repository** and work solo on their own fork. There are no shared team-a/b/c/d repositories.

CI build runs on **shared GitLab/GitHub runners** after merge to `main` on the trainee's fork. No self-hosted runner setup is required.

## Prerequisites

Before trainees run setup, the trainer must:

1. Publish the base WorkshopHub repository under `gitlab.com/thoughtworks-trainings` (or the org used for this cohort).
2. Grant trainees access to **view/fork** that base repository.
3. Ensure each trainee has a GitLab account.

## Quick Start for Trainees

**All platforms:**
Open `setup-prompt.md` in Claude Code and run it as a slash command, or follow the steps in the file manually.
