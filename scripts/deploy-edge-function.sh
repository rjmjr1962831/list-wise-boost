#!/usr/bin/env bash
# deploy-edge-function.sh — Safe deploy wrapper for serve-bot edge functions.
# Runs deno check, deploys, waits, then health-checks each function.
#
# Usage:
#   bash scripts/deploy-edge-function.sh serve-bot-home-html
#   bash scripts/deploy-edge-function.sh serve-bot-home-html serve-bot-agent-html
#   bash scripts/deploy-edge-function.sh all

set -uo pipefail

# Check deno is available
if ! command -v deno &>/dev/null; then
  echo "ERROR: deno is not installed or not in PATH."
  echo "Install it: https://deno.land/manual/getting_started/installation"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FUNCTIONS_DIR="$PROJECT_ROOT/supabase/functions"

# Health check URL mappings
declare -A HEALTH_URLS
HEALTH_URLS=(
  ["serve-bot-home-html"]="https://www.top10lists.us/"
  ["serve-bot-state-html"]="https://www.top10lists.us/arizona/top10realestateagents"
  ["serve-bot-list-html"]="https://www.top10lists.us/arizona/phoenix/top10realestateagents"
  ["serve-bot-agent-html"]="https://www.top10lists.us/arizona/agents/dina-and-mark-beauvais-4595"
  ["serve-bot-content-html"]="https://www.top10lists.us/transparency"
  ["serve-bot-founder-html"]="https://www.top10lists.us/about/founder"
  ["serve-bot-pages-html"]="https://www.top10lists.us/about"
  ["serve-bot-crawl-stats-html"]="https://www.top10lists.us/crawl-stats"
)

# Functions to skip health check
SKIP_HEALTH="serve-bot-qa-html serve-bot-list-markdown serve-bot-static-html"

# Build list of functions to deploy
TARGETS=()
if [ $# -eq 0 ]; then
  echo "Usage: bash scripts/deploy-edge-function.sh <function-name...> | all"
  echo ""
  echo "Examples:"
  echo "  bash scripts/deploy-edge-function.sh serve-bot-home-html"
  echo "  bash scripts/deploy-edge-function.sh all"
  exit 1
fi

if [ "$1" = "all" ]; then
  for dir in "$FUNCTIONS_DIR"/serve-bot-*/; do
    [ -d "$dir" ] || continue
    TARGETS+=("$(basename "$dir")")
  done
else
  TARGETS=("$@")
fi

PASS=0
FAIL=0
FAILED_NAMES=()

echo ""
echo "=== Edge Function Deploy ==="
echo "Deploying ${#TARGETS[@]} function(s)"
echo ""

for func_name in "${TARGETS[@]}"; do
  index_file="$FUNCTIONS_DIR/$func_name/index.ts"

  if [ ! -f "$index_file" ]; then
    echo "[$func_name] ERROR: $index_file not found"
    ((FAIL++))
    FAILED_NAMES+=("$func_name: file not found")
    continue
  fi

  # Step 1: Type check
  echo "[$func_name] Running deno check..."
  if ! deno check "$index_file" 2>&1; then
    echo "[$func_name] ABORT: Type check failed. Skipping deploy."
    ((FAIL++))
    FAILED_NAMES+=("$func_name: type check failed")
    continue
  fi
  echo "[$func_name] Type check passed."

  # Step 2: Deploy
  echo "[$func_name] Deploying..."
  if ! npx supabase functions deploy "$func_name" --no-verify-jwt 2>&1; then
    echo "[$func_name] ABORT: Deploy failed."
    ((FAIL++))
    FAILED_NAMES+=("$func_name: deploy failed")
    continue
  fi
  echo "[$func_name] Deployed."

  # Step 3: Wait for function to be live
  echo "[$func_name] Waiting 5 seconds for function to go live..."
  sleep 5

  # Step 4: Health check
  if echo "$SKIP_HEALTH" | grep -qw "$func_name"; then
    echo "[$func_name] Skipping health check (not applicable)."
    echo "[$func_name] PASS"
    ((PASS++))
    continue
  fi

  health_url="${HEALTH_URLS[$func_name]:-}"
  if [ -z "$health_url" ]; then
    echo "[$func_name] WARNING: No health check URL configured. Skipping health check."
    echo "[$func_name] PASS (no health check)"
    ((PASS++))
    continue
  fi

  echo "[$func_name] Health check: $health_url"
  response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$health_url" 2>/dev/null || echo "000")
  body=$(curl -s --max-time 15 "$health_url" 2>/dev/null || echo "")

  health_ok=true
  if [ "$response" != "200" ]; then
    echo "[$func_name] HEALTH FAIL: HTTP $response (expected 200)"
    health_ok=false
  fi
  if echo "$body" | grep -qi "Service Unavailable"; then
    echo "[$func_name] HEALTH FAIL: Response contains 'Service Unavailable'"
    health_ok=false
  fi

  if [ "$health_ok" = true ]; then
    echo "[$func_name] Health check passed (HTTP $response)."
    echo "[$func_name] PASS"
    ((PASS++))
  else
    echo "[$func_name] FAIL: Deployed but health check failed!"
    ((FAIL++))
    FAILED_NAMES+=("$func_name: health check failed")
  fi

  echo ""
done

echo "--- Results: $PASS passed, $FAIL failed ---"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "FAILED:"
  for name in "${FAILED_NAMES[@]}"; do
    echo "  - $name"
  done
  exit 1
else
  echo "All functions deployed and healthy."
fi
