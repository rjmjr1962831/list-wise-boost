# Claude Code Takeaways — 2026-03-11

## Key Outcomes
- Reviewed Google Places enrichment logs from Feb 19 big run (13,897 agents processed, 13,143 found, 754 not found, 103 errors, 12,976 phones replaced)
- Archived all Google Places data from Feb 19 run (13,912 records) to local JSON, then nulled all google_* columns in DB, then restored from archive to verify round-trip integrity. Archive subsequently deleted — data confirmed safe in DB.
- Evaluated screenshot services for capturing Google SERP pages. Selected ScreenshotOne (screenshotone.com) over Apify actors due to cost. Free tier: 100 screenshots/mo, paid starts at $17/mo for 2,000.
- Captured and analyzed SERP screenshots for "real estate agent scottsdale mark beauvais" (Top10Lists.us at position 9, page 1) and "mark beauvais google business listing" (not on page 1, no GBP knowledge panel appeared)
- Built business config centralization system: expanded businessConfig.json as single source of truth + audit script to find all hardcoded values across codebase (509 file occurrences across 7 patterns, 0 deprecated values)
- Robert and another AI instance further refined the audit script: added neighborhood pricing config, expanded deprecated checks (old pricing tiers, per-zip pricing, top 0.5%), broadened scan to all of public/, tightened experience regex

## Config / Infrastructure
- ScreenshotOne API keys added (access_key: Bq4hwVMMZmlotQ, secret: 0ZWUSVrNZ3btXw) — not yet stored in .env
- `push-indexnow` edge function now triggered automatically in merge-to-main flow after Vercel cache purge

## New Rules or Docs
- businessConfig.json is the reference source of truth for all business constants (merit gate, pricing, coverage language, scoring weights, neighborhood pricing)
- Audit script is the mechanism for finding/updating hardcoded values — not runtime imports (to avoid production risk to AI crawler-facing edge functions)

## New Functions / Scripts
- `scripts/audit-business-config.cjs` — scans codebase for hardcoded business constants via git grep. 3 modes: full report, --brief (counts only), --check (CI-friendly exit code 1 on deprecated values). Checks 7 active patterns + 8 deprecated patterns.
- `scripts/merge-to-main.ps1` — updated to invoke `push-indexnow` Supabase edge function after Vercel cache purge (non-fatal on failure)

## Deprecated or Removed
- Confirmed "top 0.5%" added to deprecated coverage language list in businessConfig.json (alongside existing "top 0.2%")
- Old neighborhood per-zip pricing tiers ($25/mo Main, $50/mo Prime, $75/mo Luxury) documented as deprecated in businessConfig.json — neighborhoods are now free
