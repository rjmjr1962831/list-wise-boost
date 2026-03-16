# Claude Code Takeaways — 2026-03-10

## Key Outcomes
- Rebuilt `geo-footprint-audit` edge function: replaced GPT/OpenAI with own data + website crawling + DeepSeek for AI perception queries and merge field generation
- DeepSeek used for 3 calls per agent: named query, unpromoted query, merge field generation (subject_line, opening, action_items, diy_plan)
- Enforced honest signal-strength framing in email copy — no guarantees about AI naming agents
- Removed LinkedIn from gap detection — can't reliably verify without Apify enrichment (LinkedIn blocks all direct crawling)
- Identified Apify LinkedIn actor (~$0.003/profile) as solution for LinkedIn data enrichment; not yet wired in
- Identified company data quality issue: memo23/Zillow data had wrong company for David Crozier (said Russ Lyon Sotheby's, actually Coldwell Banker for 17 years per LinkedIn)
- Smoke test completed: 20/20 emails sent via sequencer-v2-tick cron
- Fixed `list-maker-export` edge function: was not deployed (404), deployed it and created missing `list-maker-exports` storage bucket
- Fixed pagination bug in `list-maker-export`: `queryStandard` was hitting Supabase 1,000-row default cap; added proper pagination with `.range()` loop — now returns full result set (3,298 active agents)

## Config / Infrastructure
- Created `list-maker-exports` public storage bucket on Supabase for CSV download URLs
- Deployed `run-ddl` edge function for executing DDL via `SUPABASE_DB_URL` (internal to edge functions)
- Applied migration `20260310120000_geo_audit_crawl_columns.sql` via run-ddl: added columns to geo_audit_results for website crawl results, schema detection, Google Business/Homes.com gaps, email_body, gaps_found jsonb

## New Rules or Docs
- Supabase pagination rule confirmed critical: any query returning exactly 1,000 rows must be paginated
- Email merge fields are plain text/HTML for Smartleads template system — function generates content blocks, Smartleads handles HTML rendering

## New Functions / Scripts
- `supabase/functions/geo-footprint-audit/index.ts` — complete rewrite (~720 lines): data+crawl+DeepSeek approach with 12-step pipeline, AIFS scoring, website JSON-LD schema detection, AI perception Q&A, Smartleads merge field generation
- `supabase/functions/run-ddl/index.ts` — utility for DDL execution from edge function (uses internal SUPABASE_DB_URL)
- `supabase/functions/list-maker-export/index.ts` — fixed pagination in queryStandard, deployed, storage bucket created

## Deprecated or Removed
- GPT/OpenAI dependency removed from geo-footprint-audit (replaced by DeepSeek for AI perception + merge fields, own data + crawling for discovery)
- LinkedIn gap detection temporarily removed until Apify enrichment is wired in
