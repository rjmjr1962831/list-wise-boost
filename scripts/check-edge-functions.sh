#!/usr/bin/env bash
# check-edge-functions.sh — Pre-deploy type checking for all serve-bot edge functions.
# Runs `deno check` on each serve-bot-*/index.ts to catch type errors before deploy.
# Exit code: 0 = all passed, 1 = at least one failed.

set -euo pipefail

# Check deno is available
if ! command -v deno &>/dev/null; then
  echo "ERROR: deno is not installed or not in PATH."
  echo "Install it: https://deno.land/manual/getting_started/installation"
  echo "  Windows: irm https://deno.land/install.ps1 | iex"
  echo "  macOS/Linux: curl -fsSL https://deno.land/install.sh | sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FUNCTIONS_DIR="$PROJECT_ROOT/supabase/functions"

PASS=0
FAIL=0
FAILED_NAMES=()

echo ""
echo "=== Edge Function Type Check ==="
echo ""

for dir in "$FUNCTIONS_DIR"/serve-bot-*/; do
  [ -d "$dir" ] || continue
  func_name="$(basename "$dir")"
  index_file="$dir/index.ts"

  if [ ! -f "$index_file" ]; then
    echo "  SKIP  $func_name (no index.ts)"
    continue
  fi

  if deno check "$index_file" 2>&1; then
    echo "  PASS  $func_name"
    ((PASS++))
  else
    echo "  FAIL  $func_name"
    ((FAIL++))
    FAILED_NAMES+=("$func_name")
  fi
done

echo ""
echo "--- Results: $PASS passed, $FAIL failed ---"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "FAILED functions:"
  for name in "${FAILED_NAMES[@]}"; do
    echo "  - $name"
  done
  echo ""
  echo "Fix type errors before deploying."
  exit 1
else
  echo "All edge functions passed type checking."
fi
