#!/usr/bin/env bash
# Local security checks: runs Gitleaks and Trivy if available.
# Install Gitleaks: brew install gitleaks
# Install Trivy:    brew install trivy

set -euo pipefail

FAIL=0

echo "=== Security Checks ==="

# Gitleaks secret scan
if command -v gitleaks &>/dev/null; then
  echo ""
  echo "▶ Running Gitleaks secret scan..."
  if gitleaks detect --source . --config security/.gitleaks.toml --redact 2>&1; then
    echo "PASS: Gitleaks — no secrets detected"
  else
    echo "FAIL: Gitleaks detected potential secrets"
    FAIL=1
  fi
else
  echo "SKIP: gitleaks not installed (brew install gitleaks)"
fi

# Trivy vulnerability scan
if command -v trivy &>/dev/null; then
  echo ""
  echo "▶ Running Trivy filesystem scan..."
  if trivy fs . --severity CRITICAL,HIGH --ignore-unfixed --exit-code 1 2>&1; then
    echo "PASS: Trivy — no critical/high vulnerabilities"
  else
    echo "FAIL: Trivy found critical/high vulnerabilities"
    FAIL=1
  fi
else
  echo "SKIP: trivy not installed (brew install trivy)"
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "Security checks passed (or skipped due to missing tools)."
  exit 0
else
  echo "Security checks failed."
  exit 1
fi
