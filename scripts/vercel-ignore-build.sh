#!/bin/bash
# Vercel Ignored Build Step
# Exit 1 = proceed with build, Exit 0 = skip build
# Docs: https://vercel.com/docs/projects/overview#ignored-build-step
#
# Skips builds when ONLY non-deployable files changed (docs, supabase functions,
# scripts, takeaways, etc.). Saves build minutes = saves money.

echo "::Checking if build is needed..."

# If no previous deployment SHA available, must build
if [ -z "$VERCEL_GIT_PREVIOUS_SHA" ]; then
  echo "::No previous SHA — building."
  exit 1
fi

# Files/dirs that do NOT require a Vercel build when changed
SKIP_PATTERNS=(
  "^docs/"
  "^supabase/"
  "^scripts/"
  "^archives/"
  "^\.claude/"
  "^\.github/"
  "^CLAUDE\.md$"
  "^README\.md$"
  "^\.env"
  "^\.gitignore$"
)

# Build the grep pattern
SKIP_REGEX=$(IFS='|'; echo "${SKIP_PATTERNS[*]}")

# Get changed files between previous deploy and current commit
CHANGED=$(git diff --name-only "$VERCEL_GIT_PREVIOUS_SHA"..."$VERCEL_GIT_COMMIT_SHA" 2>/dev/null)

if [ -z "$CHANGED" ]; then
  echo "::No changed files detected (or SHA unreachable after rebase) — building to be safe."
  exit 1
fi

# Check if ALL changed files match skip patterns
NON_SKIP=$(echo "$CHANGED" | grep -vE "$SKIP_REGEX")

if [ -z "$NON_SKIP" ]; then
  echo "::Only non-deployable files changed — skipping build."
  echo "Changed files (all skippable):"
  echo "$CHANGED" | head -20
  exit 0
else
  echo "::Deployable files changed — building."
  echo "Files triggering build:"
  echo "$NON_SKIP" | head -20
  exit 1
fi
