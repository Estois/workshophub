#!/usr/bin/env bash
# Smoke test: validates a running WorkshopHub instance.
# Requires curl. The app must already be running.

set -euo pipefail

BASE_URL="${SMOKE_TEST_URL:-http://localhost:3001}"
FAIL=0

check() {
  local label="$1"
  local url="$2"
  local expected_status="$3"
  local expected_body="${4:-}"

  actual_status=$(curl -s -o /tmp/smoke_body -w "%{http_code}" "$url")
  actual_body=$(cat /tmp/smoke_body)

  if [ "$actual_status" != "$expected_status" ]; then
    echo "FAIL [$label] Expected HTTP $expected_status, got $actual_status — $url"
    FAIL=1
    return
  fi

  if [ -n "$expected_body" ]; then
    if ! echo "$actual_body" | grep -q "$expected_body"; then
      echo "FAIL [$label] Body does not contain '$expected_body' — $url"
      echo "     Body: $actual_body"
      FAIL=1
      return
    fi
  fi

  echo "PASS [$label] $url → HTTP $actual_status"
}

echo "=== WorkshopHub Smoke Test ==="
echo "Target: $BASE_URL"
echo ""

check "Health check"       "$BASE_URL/health"               "200" "ok"
check "Training sessions"  "$BASE_URL/api/training-sessions" "200" "title"
check "Single session"     "$BASE_URL/api/training-sessions/1" "200" "id"
check "Missing session"    "$BASE_URL/api/training-sessions/999999" "404"

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "All smoke tests passed."
  exit 0
else
  echo "Some smoke tests failed."
  exit 1
fi
