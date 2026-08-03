#!/usr/bin/env bash
# Install all prerequisites for WorkshopHub training on macOS.
#
# Tools installed:
#   - Homebrew (if not present)
#   - Node.js 24 LTS
#   - pnpm
#   - Colima (Docker runtime)
#   - Docker CLI
#   - Docker Compose plugin
#   - Trivy (security scanner)
#   - make (via Xcode Command Line Tools)
#
# Usage:
#   bash setup/install-prerequisites-mac.sh

set -euo pipefail

echo "======================================================"
echo "  WorkshopHub Training — Prerequisites Installer"
echo "  macOS"
echo "======================================================"
echo ""

# ── Homebrew ────────────────────────────────────────────
if command -v brew &>/dev/null; then
  echo "✓ Homebrew already installed ($(brew --version | head -1))"
else
  echo "→ Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  # Add brew to PATH for Apple Silicon
  if [ -f /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi
  echo "✓ Homebrew installed"
fi
echo ""

# ── make (Xcode CLI Tools) ──────────────────────────────
if command -v make &>/dev/null; then
  echo "✓ make already installed ($(make --version | head -1))"
else
  echo "→ Installing Xcode Command Line Tools (provides make)..."
  xcode-select --install || true
  echo "  If a dialog appeared, complete the installation then re-run this script."
  echo "  Skipping remaining steps until make is available."
  exit 0
fi
echo ""

# ── Node.js 24 LTS ──────────────────────────────────────
if command -v node &>/dev/null; then
  NODE_VER=$(node --version)
  echo "✓ Node.js already installed ($NODE_VER)"
  if [[ "$NODE_VER" != v24* ]]; then
    echo "  WARNING: Node.js v24 LTS is recommended. Current: $NODE_VER"
    echo "  To upgrade: brew install node@24 && brew link node@24 --force --overwrite"
  fi
else
  echo "→ Installing Node.js 24 LTS..."
  brew install node@24
  brew link node@24 --force --overwrite
  echo "✓ Node.js installed ($(node --version))"
fi
echo ""

# ── pnpm ────────────────────────────────────────────────
if command -v pnpm &>/dev/null; then
  echo "✓ pnpm already installed ($(pnpm --version))"
else
  echo "→ Installing pnpm..."
  brew install pnpm
  echo "✓ pnpm installed ($(pnpm --version))"
fi
echo ""

# ── Colima + Docker CLI + Docker Compose ────────────────
if command -v colima &>/dev/null; then
  echo "✓ Colima already installed ($(colima version 2>/dev/null | head -1 || echo 'installed'))"
else
  echo "→ Installing Colima (Docker runtime)..."
  brew install colima
  echo "✓ Colima installed"
fi

if command -v docker &>/dev/null; then
  echo "✓ Docker CLI already installed ($(docker --version))"
else
  echo "→ Installing Docker CLI..."
  brew install docker
  echo "✓ Docker CLI installed"
fi

if docker compose version &>/dev/null 2>&1; then
  echo "✓ Docker Compose already installed ($(docker compose version --short 2>/dev/null || echo 'installed'))"
else
  echo "→ Installing Docker Compose plugin..."
  brew install docker-compose
  mkdir -p ~/.docker/cli-plugins
  ln -sfn "$(brew --prefix docker-compose)/bin/docker-compose" ~/.docker/cli-plugins/docker-compose
  echo "✓ Docker Compose installed"
fi
echo ""

# ── Trivy ───────────────────────────────────────────────
if command -v trivy &>/dev/null; then
  echo "✓ Trivy already installed ($(trivy --version | head -1))"
else
  echo "→ Installing Trivy (security scanner)..."
  brew install trivy
  echo "✓ Trivy installed ($(trivy --version | head -1))"
fi
echo ""

# ── Start Colima if not running ─────────────────────────
if colima status 2>/dev/null | grep -q "Running"; then
  echo "✓ Colima is already running"
else
  echo "→ Starting Colima..."
  colima start
  echo "✓ Colima started"
fi
echo ""

echo "======================================================"
echo "  All prerequisites installed successfully!"
echo ""
echo "  Next step: follow setup/setup-prompt.md"
echo "  Start with: Step 1 — Clone your team repository"
echo "======================================================"
