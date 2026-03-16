# Claude Code Takeaways — 2026-03-14

## Key Outcomes
- Expanded city clean-room HTML pages from 3 market stats to all 14 available fields (median rent, household income, days on market, price/sqft, home size, homeownership rate, renter-occupied %, rent-to-income ratio, vacancy rate, YoY change, inventory level, market type)
- Wired up neighborhood clean-room HTML pages to pull rich market stats from `marketing_content` table (previously only used 4 fields from `neighborhood_catalog`)
- Fixed variable ordering bug: `isNh` was used before definition in `serve-bot-list-html`, causing neighborhood marketing_content queries to always fall through to city queries
- Added Dataset JSON-LD structured data for city market stats (neighborhoods already had this)
- Verified Scottsdale city page renders 14 stats, Arcadia neighborhood page renders 13 stats
- All percentages now properly formatted (e.g., "64.0%" instead of raw "0.64"), currencies prefixed with "$"

## Config / Infrastructure
- Edge function `serve-bot-list-html` deployed to Supabase project `wiotrvoirdgzfacuuiem`
- No new env vars or credentials

## New Rules or Docs
- None

## New Functions / Scripts
- None (updated existing `serve-bot-list-html` edge function)

## Deprecated or Removed
- Old 3-stat city market table rendering replaced with full 14-field rendering
- Old 4-stat neighborhood market table is now fallback only (used when no `marketing_content` entry exists for the neighborhood)
