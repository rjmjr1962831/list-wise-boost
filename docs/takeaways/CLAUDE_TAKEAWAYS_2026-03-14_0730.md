# Claude Code Takeaways -- 2026-03-14

## Key Outcomes

### Neighborhood & City Market Stats Enrichment (AZ + CA)
- Enriched all AZ and CA neighborhoods with full 14-field market stats via DeepSeek API
- Arizona: 2,967/2,967 neighborhoods -- 100% complete
- California: 7,492/7,492 neighborhoods -- 100% complete
- Total: 10,459 neighborhoods enriched with median home price, rent, household income, days on market, price/sqft, home size, homeownership rate, renter %, rent-to-income ratio, vacancy rate, YoY change, inventory level, market type
- Fixed 743 page key mismatches: renamed old-format `neighborhood-{slug}` to `neighborhood-{citySlug}-{slug}` so `serve-bot-list-html` can find them
- AZ/CA cities: 9 remaining cities enriched with marketStats sub-field (all were missing medianRent)
- Initially ran enrichment across all states (TX, FL, CO, NY) -- Robert stopped it. Only AZ and CA are authorized for enrichment.

### enrich-city-market-stats Edge Function Rewrite
- Switched from broken Vercel AI Gateway (Gemini Flash) to DeepSeek API
- Added 3 modes: `cities` (default), `neighborhoods`, `fix-keys`
- Added `states` filter parameter to restrict enrichment to specific states (e.g., `["Arizona","California"]`)
- Added `limit` and `offset` params (removed old 10-city hardcoded cap)
- Neighborhoods mode: queries `neighborhood_catalog` for missing entries, generates stats via DeepSeek, inserts into `marketing_content` with correct page key format
- fix-keys mode: renames old-format page keys by joining against `neighborhood_catalog`

### Serper.dev Entity Report Cost Analysis
- Ran entity research on Jeff Sibbach (Scottsdale, AZ) using Serper.dev web search API
- Found 24 of 27 requested fields (identity, demographics, education, professional, social profiles)
- 3 missing fields are photo-related (require authenticated page fetch, ~$0.001 additional)
- Cost: $0.003 (3 Serper searches) vs friend's $0.09/report -- 30x cheaper at 89-96% coverage
- Created case study document: `docs/case-studies/serper-entity-report-comparison.md`
- Emailed report to robert@aryah.ai via gmail-send edge function

### CLAUDE.md Major Rewrite
- Robert rewrote CLAUDE.md from scratch -- now 20 sections, comprehensive operating manual
- Key additions: Section 15 (Dead Infrastructure table), Section 20 (Value Proposition/Sales Context with ROI framing), Section 4 expanded (tier framing, positioning as infrastructure not directory, team pricing, cancellation policy)
- Stack description updated: "Static HTML (humans) + clean room HTML (AI)" -- explicitly no React SPA, no JS-rendered pages
- New rule: "Never use em dashes" (use -- instead)
- New rule: "Never link out of a funnel page"

## Config / Infrastructure
- `enrich-city-market-stats` edge function deployed to Supabase (rewritten with DeepSeek + 3 modes)
- `marketing_content` table: 10,459 new `market_stats` rows for AZ+CA neighborhoods
- 743 existing `marketing_content` rows had page keys fixed (old format -> new format)
- `scripts/enrich-neighborhoods-market-stats.mjs` -- new batch runner script with `--states`, `--limit`, `--batch`, `--dry-run` params

## New Rules or Docs
- Only enrich AZ and CA for now -- do not run enrichment on TX, FL, CO, NY without Robert's approval
- CLAUDE.md is now the operating manual (not just a config file) -- all Claude instances should load it at session start
- `docs/case-studies/` directory created for business analysis documents

## New Functions / Scripts
- `supabase/functions/enrich-city-market-stats/index.ts` -- rewritten: DeepSeek API, 3 modes (cities/neighborhoods/fix-keys), states filter, limit/offset
- `scripts/enrich-neighborhoods-market-stats.mjs` -- batch runner for neighborhood enrichment with progress logging
- `scripts/send-sibbach-report.mjs` -- one-off script to send entity research report via gmail-send

## Deprecated or Removed
- Vercel AI Gateway (`ai.gateway.vercel.dev`) for market stats -- replaced by DeepSeek API (gateway was returning errors)
- Old 10-city hardcoded cap in enrich-city-market-stats removed
- Old page key format `neighborhood-{slug}` (without city prefix) -- 743 rows migrated to `neighborhood-{citySlug}-{slug}`
