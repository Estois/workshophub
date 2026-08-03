# WorkshopHub Training Setup Prompt

> Save this file to your Claude Code project or paste it as a slash command to automate your training environment setup.

---

## What this does

1. Helps you fork the WorkshopHub base repository and clone your fork.
2. Installs dependencies and verifies the local build.
3. Starts the application and confirms it is running.

You work **solo** on your own fork — there are no shared team-a/b/c/d repositories.
No self-hosted runner is required. Merge to `main` on your fork runs the shared CI **build** job on GitLab/GitHub hosted runners.

---

## Prerequisites (complete before running)

- [ ] You have a GitLab account and can access the base WorkshopHub repository (trainer will share the URL).
- [ ] [Optional] All required tools are installed (Node.js, pnpm, Docker, Docker Compose, make) — see **Step 0** below.

---

## Setup Instructions

Run the following steps in order. Each step has a verification check.

### Step 0: Install prerequisites

Run the installer script for your operating system. It detects what is already installed and only installs what is missing.

**macOS:**
```bash
bash setup/install-prerequisites-mac.sh
```

- Installs Homebrew if not present, then uses it to install Node.js 24 LTS, pnpm, Colima, Docker CLI, and Docker Compose.
- Starts Colima (Docker runtime) automatically.

**Windows (PowerShell):**
```powershell
.\setup\install-prerequisites-windows.ps1
```

- Uses `winget` to install Node.js 24 LTS, pnpm, Git for Windows, and Rancher Desktop (includes Docker and Docker Compose).
- After installation, launch Rancher Desktop from the Start menu and wait for it to finish initialising.
- Run all `make` commands in **Git Bash** (not PowerShell).

After the script completes, open a new terminal so all tools are on your PATH.

### Step 1: Fork the base repository and clone your fork

Confirm your SSH key is added to your GitLab account:

1. Check whether you already have a key: `ls ~/.ssh/id_ed25519.pub` (or `id_rsa.pub`)
2. If not, generate one: `ssh-keygen -t ed25519 -C "your@email.com"` — accept the default path, set a passphrase.
3. Copy the public key: `cat ~/.ssh/id_ed25519.pub` — copy the entire output.
4. Add it in GitLab: go to `https://gitlab.com/-/user_settings/ssh_keys`, paste the key, and save.
5. Test the connection: `ssh -T git@gitlab.com` — you should see "Welcome to GitLab, @username!"

Then fork and clone:

1. Open the base WorkshopHub project URL the trainer shared (under `gitlab.com/thoughtworks-trainings`).
2. Click **Fork** and create the fork under **your personal namespace** (not a shared group).
3. Clone **your fork** (replace `YOUR_USERNAME` and the project path if different):

```bash
git clone "git@gitlab.com:YOUR_USERNAME/workshophub.git"
cd workshophub
```

Optional: keep the upstream base so you can pull trainer updates later:

```bash
git remote add upstream git@gitlab.com:thoughtworks-trainings/workshophub.git
git remote -v
```

Verify: `ls` should show `api/`, `app/`, `Makefile`, `README.md`.

### Step 2: Install dependencies and set up the database

```bash
make setup
```

This installs all pnpm dependencies, generates the Prisma client, pushes the database schema, and seeds sample data.

Verify: no errors. You should see "Setup complete. Run 'make dev' to start."

### Step 3: Run the tests

```bash
make test
```

Verify: all tests pass (at minimum 7 tests).

### Step 4: Start the application

In one terminal:
```bash
make dev
```

Then open a second terminal and run the smoke test:
```bash
make smoke-test
```

Verify: all smoke tests pass (Health check, Training sessions, Single session, Missing session).

Open http://localhost:5173 in your browser and confirm the training sessions list loads.

Stop the dev server (`Ctrl+C`) after verifying.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ssh -T git@gitlab.com` fails | Check your SSH key is added at `gitlab.com/-/user_settings/ssh_keys`; run `ssh-add ~/.ssh/id_ed25519` if the key is not loaded |
| Cannot fork / cannot see base project | Ask the trainer to grant you Guest/Reporter access to the base repo |
| Cloned the base instead of your fork | Check `git remote -v` — `origin` should be under **your** username |
| `pnpm: command not found` | Run `npm install -g pnpm` |
| `make: command not found` | macOS: `xcode-select --install`; Windows: use Git Bash |
| `prisma db push` fails | Check `DATABASE_URL` in `.env` — copy from `.env.example` |
| Port 3001 already in use | Run `lsof -i :3001` and kill the process |
