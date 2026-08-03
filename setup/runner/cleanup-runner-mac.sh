#!/usr/bin/env bash
# Remove the GitLab self-hosted runner from this macOS machine.
#
# Usage:
#   bash cleanup-runner-mac.sh
#
# This script:
#   1. Stops and uninstalls the runner LaunchAgent service.
#   2. Unregisters the runner from GitLab.
#   3. Optionally removes the runner binary and config.

set -euo pipefail

echo "======================================================"
echo "  WorkshopHub Training — Remove Self-hosted Runner"
echo "  macOS cleanup"
echo "======================================================"
echo ""

if ! command -v gitlab-runner &>/dev/null; then
  echo "gitlab-runner not found on this machine. Nothing to remove."
  exit 0
fi

# Stop and uninstall the LaunchAgent service
echo "Stopping runner service..."
gitlab-runner stop 2>/dev/null || true

echo "Uninstalling runner LaunchAgent..."
gitlab-runner uninstall 2>/dev/null || true
echo "✓ Runner service stopped and uninstalled"

# Unregister from GitLab (requires network access)
echo ""
echo "Unregistering all runners configured on this machine from GitLab..."
gitlab-runner unregister --all-runners 2>/dev/null || \
  echo "  Note: Could not contact GitLab. The trainer will delete the offline runner from the GitLab UI."
echo "✓ Done"

# Optionally remove the binary
echo ""
read -rp "Remove gitlab-runner binary from /usr/local/bin? [y/N]: " REMOVE_BIN
if [[ "${REMOVE_BIN:-N}" =~ ^[Yy]$ ]]; then
  sudo rm -f /usr/local/bin/gitlab-runner
  echo "✓ gitlab-runner binary removed"
fi

# Optionally remove the config directory
echo ""
read -rp "Remove runner config (~/.gitlab-runner/)? [y/N]: " REMOVE_CONFIG
if [[ "${REMOVE_CONFIG:-N}" =~ ^[Yy]$ ]]; then
  rm -rf "$HOME/.gitlab-runner"
  echo "✓ Runner config removed"
fi

echo ""
echo "======================================================"
echo "  Runner removed from this machine."
echo ""
echo "  The trainer will confirm the runner is gone from:"
echo "  GitLab → repo → Settings → CI/CD → Runners"
echo "======================================================"
