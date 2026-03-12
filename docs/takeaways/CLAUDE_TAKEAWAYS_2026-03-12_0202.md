# Claude Code Takeaways — 2026-03-12

## Key Outcomes
- Implemented Vercel Ignored Build Step to skip builds when only non-deployable files change — estimated to cut $185/mo build minutes roughly in half
- Built and reviewed business config audit script (`audit-business-config.cjs`) — found and fixed 6 issues in the original implementation (scan scope, false positives, missing deprecated patterns)
- Eliminated all neighborhood/zip pricing across codebase — neighborhoods are now free, verified via manual audit (3+ transactions in 18 months), shows "Audit Pending" until verified
- Fixed deprecated values found by audit: `public/for-ai.txt` "top 0.5%", `public/terms/index.html` "4.8+ Merit Gate" and "20+ verified reviews"
- Deprecated `profile_link` field — nulled all 51,061 rows in professionals table; short codes (`/p/xxxxx`) no longer used
- Deployed `push-indexnow` edge function (was never deployed, every ptm IndexNow ping was silently failing with 404)
- Confirmed Serper.dev API keys in `.env` are unused — zero codebase references

## Config / Infrastructure
- `vercel.json`: added `ignoreCommand: "bash scripts/vercel-ignore-build.sh"` — skips builds for docs/, supabase/, scripts/, archives/, .claude/ changes
- `push-indexnow` edge function deployed to Supabase (was missing since it was added to ptm)
- `professionals.profile_link` column: all values nulled (51,061 rows), field deprecated
- DB confirmed clean: `certification_pricing_config` has correct tier pricing ($0/$300/$500), `agent_neighborhood_subscriptions` has 0 rows, no separate pricing_configs table exists
- Serper.dev: `SERPER_API_KEY` and `SERPER_API_KEY_2` in `.env` but zero code references — can be removed

## New Rules or Docs
- Neighborhood Expert is free — no charge for neighborhood placement
- Neighborhood verification: agent self-declares expertise, then manual review confirms 3+ transactions in past 18 months in that neighborhood
- Until verified, neighborhood listing shows "Audit Pending"
- Short code profile links (`/p/xxxxx`) are dead — use canonical URLs: `/{state}/agents/{slug}` (clean room) or `/{state}/{city}/top10realestateagents/{slug}` (long-tail)
- Coverage language deprecated list now includes "top 0.5%" (was missing from audit)

## New Functions / Scripts
- `scripts/vercel-ignore-build.sh` — Vercel Ignored Build Step: checks `git diff` between deploys, exits 0 (skip) if only non-deployable files changed
- `scripts/audit-business-config.cjs` — scans codebase for hardcoded business constants against `businessConfig.json` source of truth; 3 modes: full, --brief, --check (CI gate)
  - Scans all of `public/`, `src/`, `supabase/functions/`
  - 7 active value patterns (merit gate, pricing, coverage language)
  - 8 deprecated patterns (top 0.5%, top 0.2%, old pricing, old merit gate, neighborhood pricing)

## Deprecated or Removed
- Neighborhood/zip pricing — all zeroed: `neighborhoodPricing.ts`, `pricingConfig.json`, `arizonaCityPricing.ts` (53 cities), `TIER_PRICING` constants
- `ZipCodesStep.tsx` — removed paid tier UI ($15-$100/mo per zip), replaced with "Free" badges and audit pending messaging
- `Chatbot.tsx` — removed early adopter/retail pricing sections, replaced with free neighborhood model
- `professionals.profile_link` — all 51,061 values nulled, short codes deprecated
- Serper.dev API keys — confirmed unused, candidate for removal from `.env`
