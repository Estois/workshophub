# WorkshopHub

WorkshopHub is an internal training registration system. Employees browse and register for internal training sessions. This repository is the baseline codebase template for the 3-day AI-assisted software delivery training.

## Quick Start

```bash
make setup    # Install deps, push schema, seed database
make dev      # Start frontend (port 5173) + backend (port 3001)
```

Open http://localhost:5173 to see the training sessions list.

## Port Allocation

| Environment | Service  | Port |
|-------------|----------|------|
| Dev         | Frontend | 5173 |
| Dev         | API      | 3001 |
| Prod        | Frontend + API | 8080 |

Dev and prod run on separate ports — no conflict when both are running locally.

## Setup Guide

### Easier option: use the setup prompt

If you are using Claude Code, the fastest way to set up is to run the included setup prompt as a slash command:

```bash
/setup/setup-prompt.md
```

This guides Claude through cloning, installing dependencies, running tests, and verifying the local app.

Proceed with the manual steps below if you prefer to set up without Claude Code.

### Prerequisites

Run the installer script for your OS — it detects what is already installed and only installs what is missing:

**macOS:**
```bash
bash setup/install-prerequisites-mac.sh
```

Installs: Homebrew, Node.js 24 LTS, pnpm, gh CLI, Colima, Docker CLI, Docker Compose.

**Windows (PowerShell):**
```powershell
.\setup\install-prerequisites-windows.ps1
```

Installs via winget: Node.js 24 LTS, pnpm, gh CLI, Git for Windows, Rancher Desktop (includes Docker and Docker Compose).

After the script completes, open a new terminal so all tools are on your PATH.

Verify your tools are ready:

```bash
node --version         # v24.x.x
pnpm --version         # 9.x.x
docker --version       # Docker version ...
docker compose version # Docker Compose version ...
gh --version           # gh version ...
make --version         # GNU Make ...
```

### First-Time Setup

Run these commands once after cloning:

```bash
make setup
```

`make setup` does the following in one step:
- Copies `.env.example` to `.env` if not already present
- Installs all pnpm workspace dependencies
- Generates the Prisma client
- Pushes the database schema to SQLite
- Seeds the database with sample training sessions

Verify setup succeeded:

```bash
make test    # all tests should pass
```

### Running Locally

Start both frontend and backend together:

```bash
make dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Health check: http://localhost:3001/health

Stop with `Ctrl+C`.

### Verifying the Running App

With `make dev` running in one terminal, open a second terminal and run:

```bash
make smoke-test
```

All four checks should pass: Health check, Training sessions list, Single session, and Missing session (404).

### Resetting the Database

If you need to start fresh:

```bash
make reset-db   # drops, re-pushes schema, and re-seeds
```

### Troubleshooting

| Problem | Fix |
|---------|-----|
| `pnpm: command not found` | Run `npm install -g pnpm` |
| `make: command not found` | macOS: `xcode-select --install`; Windows: use Git Bash |
| `prisma db push` fails | Check `DATABASE_URL` in `.env` — run `cp .env.example .env` |
| Port 3001 already in use | `lsof -i :3001` then `kill <PID>` |
| Port 5173 already in use | `lsof -i :5173` then `kill <PID>` |
| Port 8080 already in use | `lsof -i :8080` then `kill <PID>` |
| Tests fail with DB error | `make reset-db` then `make test` |
| Docker not running (macOS) | `colima start` before `make prod-up` |
| Docker not running (Windows) | Start Rancher Desktop before `make prod-up` |

## Production Environment (optional, local)

You can start a production-like Docker container locally. CI on `main` only runs `make build` on shared runners — it does not start prod.

```bash
make prod-up     # Build image and start production container (port 8080)
make prod-logs   # View container logs
make prod-down   # Stop container (data volume is preserved)
```

- Production is accessible at http://localhost:8080 after `make prod-up`.
- Database is persisted in a named Docker volume (`db_data`) across restarts.
- On each startup, the entrypoint runs `prisma db push` to apply any schema changes to the live database automatically.

### Database Migrations in Production

When trainees add new schema (e.g. a `Registration` table), the entrypoint applies the changes on the next container start — no manual migration step needed. Existing data is preserved for additive changes.

To fully reset the production database (wipes all data):

```bash
docker compose -f docker-compose.prod.yml down -v
make prod-up
```

## Repository Structure

```
workshophub/
  app/                   React + TypeScript + Vite frontend
  api/
    src/                 Express API source
    prisma/              Schema and seed script
    database/            SQLite database file (created at runtime, gitignored)
  docs/stories/          Jira story exports for offline reference
  hooks/                 Git hooks (pre-push)
  scripts/               Helper scripts (smoke-test, security)
  security/              Gitleaks config
  setup/                 Trainee setup and cleanup scripts
  .github/               GitHub Actions workflows
  Dockerfile             Multi-stage build (deps → builder → runner)
  docker-entrypoint.sh   Container startup — applies schema then starts server
  docker-compose.yml     Dev environment
  docker-compose.prod.yml Production environment (port 8080)
  Makefile               Stable command interface
```

## Available Commands

| Command             | Purpose                                          |
|---------------------|--------------------------------------------------|
| `make setup`        | Install dependencies and initialise database      |
| `make dev`          | Start frontend and backend locally                |
| `make test`         | Run unit and API tests                            |
| `make lint`         | Run ESLint                                        |
| `make format-check` | Check Prettier formatting                         |
| `make build`        | Build frontend and backend                        |
| `make seed`         | Seed SQLite database                              |
| `make reset-db`     | Force-reset and re-seed database                  |
| `make smoke-test`   | Validate a running application (default: port 3001) |
| `make security`     | Run local security checks                         |
| `make prod-up`      | Build and start production Docker container       |
| `make prod-down`    | Stop production container (volume preserved)      |
| `make prod-logs`    | Show production container logs                    |

## API Endpoints

| Method | Path                       | Description           |
|--------|----------------------------|-----------------------|
| GET    | /health                    | Health check          |
| GET    | /api/training-sessions     | List all sessions     |
| GET    | /api/training-sessions/:id | Get one session by ID |

## GitHub Actions Workflows

| Workflow         | Trigger         | Runner        | Purpose                                                      |
|------------------|-----------------|---------------|--------------------------------------------------------------|
| `pr-check`       | PR to main      | GitHub-hosted | Tests, lint, format check                                    |
| `security`       | Push/PR to main | GitHub-hosted | Gitleaks (disabled until licensed), Trivy (disabled — trainees re-enable in Workshop 8) |
| `build-and-prod` | Push to main    | GitHub-hosted | `make build` only (no prod container start)                  |

## Repository Secrets

No secrets are required for the build workflow. Optional Slack or other overrides are local/team configuration only — never commit `.env.production` or real secret values.

## Environment Variables

| Variable | Dev default | Prod |
|----------|------------|------|
| `DATABASE_URL` | `file:../database/workshophub.sqlite` | `file:/app/api/database/workshophub.sqlite` (set in compose) |
| `APP_PORT` | `3001` | `8080` (set in compose) |
| `NODE_ENV` | `development` | `production` (set in compose) |

## Technology Stack

| Layer           | Technology                        |
|-----------------|-----------------------------------|
| Frontend        | React 18 + TypeScript + Vite 5    |
| Backend         | Node.js 24 + TypeScript + Express |
| Database        | SQLite via Prisma ORM             |
| Testing         | Jest + Supertest                  |
| Linting         | ESLint + Prettier                 |
| Git hooks       | Husky (pre-push: test + lint)     |
| CI              | GitHub Actions                    |
| Containers      | Docker + Docker Compose           |
| Package manager | pnpm 9                            |
| Build interface | Make                              |

## Trainee Exercise Features (Not Implemented)

The following features are intentionally left unimplemented as trainee exercises:

- Employee registration for a training session
- Duplicate registration prevention
- Waitlist when a session is full
- Cancellation of registration
- Waitlist promotion after cancellation
- Organiser view of registrations
- Registration deadline enforcement
- Notification after registration or waitlist promotion
- Audit log for registration state changes
