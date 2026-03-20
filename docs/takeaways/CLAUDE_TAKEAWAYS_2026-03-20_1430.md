# t1 Takeaways — CLAUDE — 2026-03-20

## Key Outcomes
- Implemented 3 high-value GEO improvements from external audit advice
- Fixed staging deploy regression caused by rebase (SHA unreachable → ignore script skipping all builds)
- Fixed founder photos not serving on production (SPA catch-all intercepting /images/ path)
- Added founder photos for Robert Maynard and Mark Garland to founders page
- Deleted internal-sounding paragraph from founders page hero

## Config / Infrastructure
- `vercel.json`: Added `images` to SPA catch-all exclusion pattern — `/images/founders/*.png` now serves as static files instead of routing to `/_spa.html`
- `scripts/vercel-ignore-build.sh`: Changed empty diff behavior from "skip" to "build" — prevents staging from going stale after a rebase (SHA unreachable = force build)
- `supabase/functions/serve-bot-founder-html`: Deployed — removed "bank/credit bureau" paragraph from hero section

## New Rules or Docs
- None

## New Functions / Scripts
- None

## GEO Changes
- `src/pages/DynamicCategoryList.tsx`: H1 updated from "Top Agents: {city}, {state}" to "Best {category} in {city}, {state}" — query-shaped for AI chunking
- `src/components/NeighborhoodOverview.tsx`: Added `data-ai-facts="true"` sr-only block with page type, location hierarchy, agent count, merit criteria, bias controls, badge_verification (cryptographically_signed), audit cycle, last_verified (now dynamic), intended_use
- `DynamicCategoryList.tsx`: Same AI facts block added for city and neighborhood routes
- `src/data/faqFull.ts`: 3 new ai_search FAQ entries:
  - `ai_citation_risk`: How Top10Lists reduces citation risk for AI systems
  - `ai_why_choose`: Why AI prefers Top10Lists over paid directories
  - `badge_cryptographic`: Cryptographically signed badges (timed for badge launch)
- `public/api/faq/full.json`: Regenerated — 103 entries (was 100)

## Deprecated or Removed
- Hardcoded "Last verified: February 20, 2026" in NeighborhoodOverview — now dynamic (`new Date().toLocaleDateString(...)`)
- "bank does not approve a loan from memory..." paragraph removed from founders page hero
