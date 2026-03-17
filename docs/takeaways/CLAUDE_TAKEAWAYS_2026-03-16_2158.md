# Claude Code Takeaways -- 2026-03-16

## Key Outcomes

### Critical GEO Fix: 10,452 Neighborhood Pages Invisible to AI Crawlers
- Sitemap generator was producing 5-segment URLs with zip codes (`/:state/:city/:zip/:neighborhood/top10realestateagents`) but the Vercel rewrite only matched 4-segment URLs
- All 10,452 neighborhood sitemap URLs were falling through to the SPA shell, serving empty JavaScript pages to AI crawlers
- Fixed sitemap generator (`scripts/generate-static-sitemaps.ts` line 179) to output 4-segment URLs (no zip)
- Added Vercel 301 redirect from 5-segment zip URLs to 4-segment canonical
- Regenerated all sitemaps: 10,452 neighborhoods now hit clean room HTML
- Verified on production: Arcadia returns `ItemList` JSON-LD, old 5-segment URL 308 redirects correctly
- Pushed to staging and main, CDN purged, IndexNow fired (40 URLs)

### EasyDMARC DNS Analysis
- Both domains (top10lists.us, toptenlists.us) have valid SPF, DKIM, DMARC, and MX records
- EasyDMARC shows zero volume because `rua` tags point to own mailboxes, not EasyDMARC's reporting address
- DMARC policy is `p=none` on both -- sufficient for low-volume outreach, upgrade to `quarantine` later
- "Verified: no" in EasyDMARC is domain ownership verification in their dashboard, not a DNS issue
- Not blocking for low-volume email campaign launch

### Gemini GEO Advisor Analysis -- Debunked
- "Hidden Text" penalty claim about `<details><summary>` TOC: **false**. `<details>` is W3C standard progressive disclosure, not cloaking. Google explicitly allows it.
- "/for-ai 404s" claim: **false**. Returns 200 with clean room HTML and live counts.
- "Entity-Bridge Schema" proposal: directionally right on `knowsAbout` but oversimplified. We already have `ItemList`, `hasCredential`, `Dataset`, `RealEstateAgent` type -- all stronger than their example. Worth adding `knowsAbout` and `areaServed` Neighborhood to neighborhood pages, but not the Wikipedia `sameAs` or merit rationale in `knowsAbout`.

### Funnel Pricing Page (Step7Pricing) Updates
- AIFSGauge band labels changed: Fragmented -> Certified, Recognized -> Audited, High Fidelity -> Underwritten
- Added congratulations banner above AI Footprint Score: "Congratulations! You're now Certified by us."
- Removed "Ask any AI this question" challenge block with clipboard copy
- CitationROICalculator rewritten:
  - "Monthly AI Citations" -> "Expected Annual AI Leads" (default 5)
  - "Annual Sales Volume" -> "Average Deal Size" (default $800K)
  - Close rate: 40% (2 out of 5 leads close), was 30%
  - Underwritten compound multiplier: 1.5x (was 1.35x)
  - All numbers rounded to 0 decimal places except compound multiplier
  - Removed assumptions line and "What is one AI citation worth" subtitle
  - Removed helper text under AI leads input
  - Added CTA buttons: "You are here" (gray) for Certified, "Upgrade to Audited/Underwritten" for paid tiers
  - Formula updated to reflect annual leads and 40% close rate

### Sandbox Test Agent (from prior session)
- Marcus Chen (AZ, Scottsdale, Underwritten)
- ID: 149c7dfd-c70a-4a72-ad51-c991fef7ffb4
- Verification token: d2641c6b-ba41-447e-9b7b-2fa5c4203364
- Dashboard token: 68909473d4d25843b87cc4f77b0dbb4f767fddadb8f3228a093717426906e5a5
- Funnel pricing: http://localhost:8083/funnel/d2641c6b-ba41-447e-9b7b-2fa5c4203364/pricing

## Config / Infrastructure
- Vercel CDN purged and IndexNow triggered post-ptm
- 301 redirect added for legacy 5-segment neighborhood URLs
- No new env vars or secrets

## New Rules or Docs
- Neighborhood canonical URL is 4-segment: `/:state/:city/:neighborhood/top10realestateagents` (no zip)
- 5-segment URLs with zip are legacy and 301 redirect to 4-segment
- Dev server for funnel work runs on port 8083

## New Functions / Scripts
- None

## Deprecated or Removed
- 5-segment neighborhood URLs with zip codes in sitemap (migrated to 4-segment)
- "Ask any AI this question" challenge block removed from Step7Pricing
- "Monthly AI Citations" concept replaced with "Annual AI Leads"
