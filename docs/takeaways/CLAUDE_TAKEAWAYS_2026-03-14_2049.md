# Claude Code Takeaways — 2026-03-14

## Key Outcomes

### Serper.dev Enrichment POC (Jeff Sibbach)
- Ran full enrichment pipeline on Jeff Sibbach (already-qualified agent) using only Serper.dev: 7 API calls ($0.007), 8 web page crawls, 1 DeepSeek call ($0.001) = **$0.008 total per agent**
- Serper found: license verification (AZRE.gov snippets), Google Business data (Places API), social links (3 new: Homes.com, Realtor.com, YouTube), 9 awards (vs 1 in DB), 7 press mentions (vs 0 in DB), 4 community roles (vs 1 in DB)
- Serper cannot find: detailed sales stats, current listings, profile photos, review text, team member breakdowns — all require Zillow crawl

### Serper License-to-Profile POC (5 random CA agents)
- Tested pipeline: state_licenses (raw) → Serper → report on 5 random unenriched CA salespersons
- **0/5 pass merit gate** — expected since <1% qualify. 3/5 had verified licenses via DRE snippets, 0/5 had findable Zillow profiles or review data
- Serper works as a fast filter ($0.004/agent) but cannot pre-qualify agents (stars/reviews not in search snippets)

### Serper Batch Run — 1,000 CA License Holders
- **Run v1** (`"Name" city CA zillow`): 67 Zillow URLs found (6.7%), but only 40% correct (name match in URL). 30% were wrong person entirely.
- **Run v2** (`"Name" "LicenseNumber"`): 2 Zillow URLs (0.2%), both 100% correct. License number kills hit rate because Zillow doesn't index license numbers.
- **Run v3** (`"Name" "LicenseNumber" City California`): 1 Zillow URL (0.1%), correct. Adding city made it worse.
- **DRE license verification**: `site:dre.ca.gov LICENSE_NUMBER` found 14/20 (70%) with expiration dates — but we already have this data in the license table, so this is redundant.
- Key domains found in results: homes.com (108x), licensee.io (88x), compass.com (77x), zillow.com listings (60x), realtor.com (28x) — but all except licensee.io block crawlers (403).

### Exa.ai Batch Run — 100 CA License Holders
- Tested `type: "fast"` and `type: "instant"` with `includeDomains: ['zillow.com']`, `numResults: 1`
- **Both return 100% hit rate — and ~99% wrong person.** `includeDomains` forces Exa to always return *something* from zillow.com, even if it's a random agent in the same city.
- Exa fast/instant is useless for finding Zillow URLs from license data. Neural search ($0.007/req) might be more accurate but untested and expensive at scale (415K × $0.007 = $2,905).

### Enrichment Tool Landscape Research
- Surveyed: Piloterr, RapidAPI (zillow56, zillow-com1, zillow-working-api, real-time-zillow-data), Apify (6 actors), Bright Data, HasData, Scrapingdog, WebAutomation
- **Piloterr Zillow Search Professional API** accepts agent name as input, returns rating + reviews — but currently "under maintenance, temporarily suspended"
- **RapidAPI zillow56** had `search_agents` endpoint with name+location input — but API appears dead (returns "API doesn't exists")
- **Apify scrapestorm all-in-one** ($24.99/mo) and **sovereigntaylor** ($0.005/agent) search by location, possibly name
- homes.com, realtor.com, nestfully.com all block crawlers (403). licensee.io is crawlable but has no Zillow links.

### Core Finding
**The gap is: license table (name + license + city) → Zillow profile URL.** Neither Serper nor Exa can reliably bridge this. Serper finds the wrong person; Exa forces a result from zillow.com regardless of accuracy. The only reliable path is Zillow's own search — which requires either a working third-party API (all seem dead or suspended) or building our own scraper with residential proxies.

## Config / Infrastructure
- No new env vars, secrets, or infrastructure changes
- No database modifications — all tests were read-only
- Serper API keys confirmed working (SERPER_API_KEY in .env)
- Exa API key confirmed working (EXA_API_KEY in .env)
- DeepSeek API key confirmed working
- Proxy-cheap residential proxy credentials are in Supabase secrets (ROTATING_PROXY_USERNAME, ROTATING_PROXY_PASSWORD), not in local .env

## New Rules or Docs
- **Serper enrichment is valuable for already-qualified agents** — adds license verification, Google Business data, social links, awards, press, community at $0.008/agent. Replaces Exa for this use case at lower cost.
- **Serper cannot pre-qualify agents** — star ratings and review counts are not in Google search snippets from Zillow pages
- **Exa `includeDomains` with fast/instant search is unreliable** — returns random agents from the constrained domain when the target agent has no profile there
- **memo23 Apify actor price increase** — Robert reports the actor dramatically increased prices, making it unaffordable
- Reports saved to staging:
  - `docs/takeaways/SERPER_ENRICHMENT_POC_2026-03-14.md` — Jeff Sibbach full comparison
  - `docs/takeaways/SERPER_LICENSE_TO_PROFILE_POC_2026-03-14.md` — 5 raw CA agents

## New Functions / Scripts
- `C:/Users/rober/tmp/serper_batch.js` — Serper batch search v1 (name + city + zillow)
- `C:/Users/rober/tmp/serper_batch2.js` — Serper batch search v2 (name + license number)
- `C:/Users/rober/tmp/serper_batch3.js` — Serper batch search v3 (name + license + city + state)
- `C:/Users/rober/tmp/exa_batch.js` — Exa fast/instant batch test with includeDomains
- None deployed to Supabase or committed to repo (all temp/test scripts)

## Deprecated or Removed
- **Exa.ai for Zillow URL discovery** — confirmed ineffective with fast/instant search types. The `exa-ca-zillow-search` edge function in worktree `agent-a032121f` was never deployed and should not be deployed as-is (neural search at $0.007/req is too expensive for 415K agents)
- **RapidAPI zillow56** — appears dead, returns "API doesn't exists" for all endpoints

## Actual API Pricing (verified March 2026)

| Tool | Unit Cost | What It's Good For |
|------|-----------|-------------------|
| Serper.dev | $0.001/search | Social links, awards, press, license verification, Google Places |
| Exa.ai (fast/instant) | $0.007/search | NOT useful for Zillow URL discovery (too inaccurate) |
| Exa.ai (neural) | $0.007/search | Untested for this use case, likely expensive at scale |
| DeepSeek V3.2 | $0.28/M input, $0.42/M output | Text field generation (bio, headline, rationale) |
| Apify memo23 Zillow | $0.0025-0.003/agent (OLD price) | Profile scraping — but needs URL as input, price increased |
