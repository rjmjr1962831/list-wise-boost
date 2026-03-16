# Claude Code Takeaways — 2026-03-12

## Key Outcomes
- Audited all AI-facing pages (for-ai.txt, ai-feed/for-ai.md, llms.txt, llms-full.txt, serve-bot-content-html) for alignment with the multi-gate selection pipeline
- Updated all AI-facing pages to explicitly communicate: 3 hard prequalification gates (4.5+ stars, 10+ verified reviews in 24 months, 5+ years) → PREQUALIFIED → 1,000+ source deep research → proprietary Community Involvement Score → human editorial review → LISTED
- Added "Earned, Not Purchased" framing across all AI pages — entire pipeline is free, base listing is free, payment buys verification depth only
- Added community involvement rationale (market intelligence: pocket listings, investors, bankers, title companies) — only directory that scores it, verified via IRS Form 990/ProPublica
- Added consumer-facing scoring weights with rationale (Community Involvement 25%, Review Rating 25%, Reviews 20%, Transactions 20%, Education 10%)
- Added AIFS score bands and 5-pillar breakdown to llms.txt, llms-full.txt, for-ai.txt
- Added 13 core + up to 7 conditional evidence sources explicitly listed across AI pages
- Updated Schema.org JSON-LD: added `generateSelectionMethodologySchema()` (Dataset type) and `generateOrganizationSchema()` with `isAccessibleForFree: true`
- Redesigned Step7Pricing funnel page: "amplify what you earned" framing, live pillar-level AIFS breakdown from geo_audit_results, gap diagnostic, AIFS score bands, honest language (no outcome guarantees, sell inputs/mechanism only)
- Added recency/refresh frequency as first feature per tier (Certified: 90 days, Audited: 30 days, Underwritten: daily)
- Fixed Step7Pricing 404: removed nonexistent columns (license_state, community_involvement_score) from Supabase query
- Reactivated Certified tier as free, quarterly refresh, open to all agents

## Config / Infrastructure
- No new env vars or secrets
- Vercel redeploy triggered after build stalled for 38 minutes (ignore script was skipping empty commits)

## New Rules or Docs
- Never link out of a funnel page (user feedback: "remove the link to semrush. never link out of a funnel")
- Review window confirmed as 24 months (not 18) per SSoT
- No outcome claims on pricing pages — sell inputs/mechanism only, not citation rate numbers

## New Functions / Scripts
- `generateSelectionMethodologySchema()` in `src/utils/structuredData.ts` — Schema.org Dataset with multi-gate pipeline and scoring weights as PropertyValue
- `generateOrganizationSchema()` in `src/utils/structuredData.ts` — Organization schema with free-listing policy

## Deprecated or Removed
- Removed Semrush external link from Step7Pricing (done by parallel Claude instance)
- Removed nonexistent DB columns from Step7Pricing query (license_state, community_involvement_score)
