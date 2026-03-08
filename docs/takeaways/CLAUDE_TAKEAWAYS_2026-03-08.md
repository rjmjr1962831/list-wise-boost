# t1 Takeaways — CLAUDE — 2026-03-08

## Key Outcomes
- Ran `ryt`: updated `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md` on staging (commit bc0a679).
- Discovered that `MASTER_KNOWLEDGE_DOCUMENT.md` does not exist at repo root on staging. Canonical file is `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md`.
- Discovered and read `docs/prompts/t1-takeaways-prompt.md` (new t1 protocol).

## Config / Infrastructure
- Active Supabase project: `wiotrvoirdgzfacuuiem` (only valid project).
- Dead project `bgdtekbhelormzbymkhh` surfaced in a session-provided enrichment-api code block. That endpoint is permanently dead. All operations go to `wiotrvoirdgzfacuuiem`.
- Enrichment API: `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api`

## New Rules or Docs
- `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md` updated:
  - Section 12 (Supabase Pagination) expanded with per-table row counts, pagination code patterns for both enrichment-api and Supabase client, and the "exactly 1,000 rows = more rows exist" warning.
  - Section 14 (Tech Stack) gained explicit DEAD INFRASTRUCTURE callout for old Supabase project `bgdtekbhelormzbymkhh`.
  - Section 19 (Conflict Resolution) gained new row: `bgdtekbhelormzbymkhh` -> `wiotrvoirdgzfacuuiem`.
  - Last consolidated date updated to March 8, 2026.
- `docs/prompts/t1-takeaways-prompt.md` exists (new prompt; defines t1 behavior for all AI agents).

## New Functions / Scripts
- None added this session.

## Deprecated or Removed
- `bgdtekbhelormzbymkhh` Supabase project: confirmed dead, documented as such.
- Any session notes or external docs referencing the old enrichment-api endpoint (`bgdtekbhelormzbymkhh`) should be treated as stale and ignored.
