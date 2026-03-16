# Claude Code Takeaways — 2026-03-14

## Key Outcomes
- Built and launched **GEO Uplift Analysis** across all 3,274 active agents — measures the value Top10Lists.us provides to each agent's AI discoverability
- For each agent, runs two Google searches (via Serper API): one excluding top10lists.us, one including it. GPT-4o-mini synthesizes recommendations from search results, then classifies uplift as significant/moderate/minimal
- Early results (933/3,274 processed): **70% significant**, 19% moderate, 11% minimal — strong validation of the GEO value proposition
- Built and launched **Tier Projection** script — projects what each agent's recommendation would look like at Certified, Audited, and Underwritten tiers
- Tier projection early results (71 processed): near-100% significant across all paid tiers

## Config / Infrastructure
- Added 9 new columns to `professionals` table via `run-migration` edge function:
  - `recommendation_without`, `recommendation_with`, `uplift` (base analysis)
  - `projected_rec_certified`, `projected_rec_audited`, `projected_rec_underwritten` (tier projections)
  - `projected_uplift_certified`, `projected_uplift_audited`, `projected_uplift_underwritten` (tier uplift classification)
- Migration deployed via `supabase/functions/run-migration/index.ts` (updated to include new columns)
- Migration file created: `supabase/migrations/20260313183000_add_geo_uplift_columns.sql` (not pushed — old migrations conflict with `db push`)

## New Rules or Docs
- None

## New Functions / Scripts
- `scripts/geo-uplift-analysis.cjs` — Base GEO uplift analysis. Serper + OpenAI pipeline. Resumable (skips agents with existing results). ~16s/agent. Uses PostgREST PATCH for writes (run_sql blocks UPDATE/DDL)
- `scripts/geo-tier-projection.cjs` — Tier uplift projection. Runs on agents that already have base results. Projects Certified/Audited/Underwritten recommendations. Auto-waits for base analysis to feed it new agents. ~18s/agent
- Both scripts write progress logs to `scripts/geo-uplift-progress.log` and `scripts/geo-tier-projection.log`

## Deprecated or Removed
- `supabase/functions/run-migration/index.ts` was repurposed from its original email-tables migration to the uplift columns migration. Previous email table DDL statements were replaced.
