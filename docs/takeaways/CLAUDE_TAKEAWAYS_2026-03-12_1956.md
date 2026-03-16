# Claude Code Takeaways — 2026-03-12

## Key Outcomes
- Fixed `run_sql` endpoint in enrichment-api: replaced broken raw postgres connection (stale DB password) with Supabase JS client `.rpc('run_sql')` — now works reliably
- Rewrote social pillar in `batch-aics-score` scoring model:
  - Decoupled review volume/quality from recency — unlisted agents with strong reviews no longer zeroed out
  - Tier amplification now has a 0.5 floor so unlisted agents still earn social credit
  - Switched reviewVolume from linear cap (`min(10, floor(rc/5))`) to log scale (`min(20, round(log2(rc+1)*2))`) — agents with 1,000+ reviews now properly outscore agents with 50
- Capped max AIFS score at 95 (was 99)
- Added Exa result caching: `batch-aics-score` now reads cached `exa_sources` from `geo_audit_results` instead of calling Exa API on every run — scores are deterministic
- Added `agent_ids` parameter to `batch-aics-score` for targeted re-scoring of specific agents
- Added `force_rescore` and `rescore_after` parameters for bulk re-scoring without manual DB resets
- Re-scored all 3,262 active agents (872 AZ + 2,390 CA) with the new model

## Config / Infrastructure
- Updated Supabase secret `DB_URL` on project `wiotrvoirdgzfacuuiem` (set to correct direct postgres connection string)
- Updated Supabase secret `DATABASE_URL` on project `wiotrvoirdgzfacuuiem`
- Enrichment-api SQL endpoint now uses Supabase RPC instead of deno-postgres Pool

## New Rules or Docs
- CLAUDE.md: Added GEO approval gate — any action that may reduce GEO score requires Robert's explicit approval
- CLAUDE.md: Added SSoT usage rule — actively reference pk document throughout session, cite section numbers
- CLAUDE.md: Documented both SQL access methods (enrichment-api POST and Supabase REST RPC)
- Auto-memory: Added post-pk rules check (4 questions to answer after loading pk document)

## New Functions / Scripts
- No new edge functions created
- `batch-aics-score` significantly enhanced:
  - `agent_ids` param: array of UUIDs for targeted re-scoring
  - `force_rescore` param: re-score all agents ignoring audit freshness
  - `rescore_after` param: ISO timestamp to skip agents already re-scored after that time
  - Exa caching: reads `geo_audit_results.exa_sources` before calling Exa API

## Deprecated or Removed
- Old social pillar formula (`Math.round(Math.min(10, rc) * (tierRec / 10))`) replaced — tierRec no longer gates review credit
- Old reviewVolume linear formula (`min(10, floor(rc/5))`) replaced with log scale
- Raw deno-postgres connection in enrichment-api SQL handler removed (was broken due to stale DB password)
