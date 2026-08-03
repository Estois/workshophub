#!/usr/bin/env bash
# Install and configure a GitLab self-hosted runner on macOS.
#
# Prerequisites:
#   - macOS 12+
#   - curl
#   - GitLab project membership (collaborator)
#
# Usage (run from inside your cloned team repo):
#   bash setup/runner/setup-runner-mac.sh

set -euo pipefail

GL_URL="https://gitlab.com"
GL_ORG="thoughtworks-trainings"
DEFAULT_REPO="$(basename "$(pwd)")"

echo "======================================================"
echo "  WorkshopHub Training — GitLab Self-hosted Runner"
echo "  macOS installer"
echo "======================================================"
echo ""

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  RUNNER_ARCH="arm64"
else
  RUNNER_ARCH="amd64"
fi
echo "Detected architecture: $ARCH → runner binary: gitlab-runner-darwin-${RUNNER_ARCH}"
echo ""

# Confirm repo name (default to current folder)
read -rp "Repository name [${DEFAULT_REPO}]: " GL_REPO
GL_REPO="${GL_REPO:-$DEFAULT_REPO}"

echo ""
echo "Group/Org  : $GL_ORG"
echo "Repository : $GL_REPO"
echo ""
echo "You need a runner registration token from GitLab."
echo "Steps to get it:"
echo "  1. Go to: ${GL_URL}/${GL_ORG}/${GL_REPO}/-/settings/ci_cd"
echo "  2. Expand the 'Runners' section"
echo "  3. Click 'New project runner'"
echo "  4. Set tags: self-hosted, workshophub  (required — the CI pipeline uses both tags)"
echo "  5. Click 'Create runner'"
echo "  6. Copy the token shown (starts with 'glrt-')"
echo ""
read -rsp "Runner registration token (glrt-...): " RUNNER_TOKEN
echo ""

if [ -z "$RUNNER_TOKEN" ]; then
  echo "ERROR: Runner registration token is required."
  exit 1
fi

# Install gitlab-runner binary if not already installed
if command -v gitlab-runner &>/dev/null; then
  echo "✓ gitlab-runner already installed ($(gitlab-runner --version | head -1))"
else
  echo "Installing gitlab-runner binary to ~/.local/bin (no sudo required)..."
  RUNNER_DIR="$HOME/.local/bin"
  mkdir -p "$RUNNER_DIR"
  RUNNER_BIN="$RUNNER_DIR/gitlab-runner"
  curl -fsSL -o "$RUNNER_BIN" \
    "https://gitlab-runner-downloads.s3.amazonaws.com/latest/binaries/gitlab-runner-darwin-${RUNNER_ARCH}"
  chmod +x "$RUNNER_BIN"
  # Add to PATH for this session if not already on PATH
  export PATH="$RUNNER_DIR:$PATH"
  # Persist to shell profile if needed
  if ! grep -q "$RUNNER_DIR" "$HOME/.zshrc" 2>/dev/null && ! grep -q "$RUNNER_DIR" "$HOME/.bash_profile" 2>/dev/null; then
    SHELL_PROFILE="$HOME/.zshrc"
    [ -f "$HOME/.bash_profile" ] && SHELL_PROFILE="$HOME/.bash_profile"
    echo "export PATH=\"$RUNNER_DIR:\$PATH\"" >> "$SHELL_PROFILE"
    echo "  Added $RUNNER_DIR to PATH in $SHELL_PROFILE"
  fi
  echo "✓ gitlab-runner installed to $RUNNER_BIN"
fi
echo ""

# Register the runner with GitLab
echo "Registering runner with GitLab..."
gitlab-runner register \
  --non-interactive \
  --url "$GL_URL" \
  --token "$RUNNER_TOKEN" \
  --executor "shell" \
  --description "$(hostname)-workshophub" \
  --tag-list "self-hosted,workshophub,macOS" \
  --run-untagged=false

echo "✓ Runner registered"
echo ""

# Install as a LaunchAgent (runs in background, auto-starts on login)
echo "Installing runner as a macOS LaunchAgent..."
gitlab-runner install
gitlab-runner start
echo "✓ Runner service started"

echo ""
echo "======================================================"
echo "  Runner installed and running!"
echo ""
echo "  To verify: ${GL_URL}/${GL_ORG}/${GL_REPO}"
echo "             Settings → CI/CD → Runners"
echo "             Your runner should appear as online (green circle)"
echo ""
echo "  To stop the runner:  gitlab-runner stop"
echo "  To start again:      gitlab-runner start"
echo "  To remove:           bash setup/runner/cleanup-runner-mac.sh"
echo "======================================================"
