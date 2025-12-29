# API Deprecation Guide

## Active Pipeline (As of 2025-12-29)

This project uses a **TWO-STEP** pipeline for all real estate agent data:

### Step 1: Exa → Prequalification
- **Purpose:** Find Zillow URL, extract rating/reviews
- **Qualification criteria:** 4.8+ rating AND 20+ reviews
- **Edge function:** `search-agent-exa`, `test-exa-search`

### Step 2: Firecrawl → Full Enrichment  
- **Purpose:** Scrape full agent profile data from Zillow
- **Only runs on:** Agents that PASS prequalification
- **Edge functions:** `fetch-zillow-agent-firecrawl`, `scrape-zillow-firecrawl`, `import-agents-firecrawl`

## DEPRECATED - DO NOT USE

### Deprecated Apify Actors (ALL)
- ❌ `memo23~apify-zillow-agents-cheerio` 
- ❌ `getdataforme~zillow-real-state-agents-scraper`
- ❌ `agenscrape~zillow-agents-finder`
- ❌ `getdataforme~agenscrape`
- ❌ `rigelbytes~zillow-agents`
- ❌ ANY other Apify actors

### Deprecated Third-Party Services
- ❌ **Apify** - All actors deprecated
- ❌ **Perplexity API** - Removed entirely  
- ❌ **Outscraper API** - Google Business reviews no longer fetched

### Deprecated Edge Functions (Apify-based)
1. `fetch-agenscrape-agents` - Uses getdataforme actor
2. `fetch-apify-zillow-cheerio` - Uses memo23 actor
3. `fetch-memo23-agents` - Uses memo23 actor
4. `fetch-single-memo23-agent` - Uses memo23 actor
5. `bulk-fetch-zillow-reviews` - Uses memo23 actor
6. `capture-zillow-rankings` - Uses getdataforme actor
7. `search-and-import-agent` - Uses agenscrape actor
8. `fetch-rigelbytes-agents` - Uses rigelbytes actor
9. `run-state-pipeline` - Uses Apify actors dynamically
10. `poll-apify-runs` - Polls Apify actor runs
11. `process-state-licenses` - Uses rigelbytes actor
12. `fetch-zillow-agents-twostep` - Uses getdataforme + memo23
13. `fetch-zillow-profile-stats` - Replaced by Firecrawl
14. `fetch-apify-agent-stats` - Replaced by Firecrawl
15. `fetch-external-reviews` - External reviews deprecated
16. `fetch-zillow-agents-bulk` - Replaced by Firecrawl
17. `scrape-zillow-agents` - Uses Apify

### Deprecated Admin Components
These components have been disabled as they call deprecated Apify functions:
- `AgenScrapeImporter` - calls fetch-agenscrape-agents, fetch-apify-zillow-cheerio
- `ZillowAgentImporter` - calls fetch-agenscrape-agents
- `BulkMemo23Enricher` - calls fetch-memo23-agents
- `SingleAgentMemo23` - calls fetch-single-memo23-agent
- `AdminRankingCapture` - calls capture-zillow-rankings
- `BulkZillowReviewsFetcher` - calls bulk-fetch-zillow-reviews
- `AdminZillowScraper` - calls scrape-zillow-agents
- `StatePipelineRunner` - calls process-state-licenses (rigelbytes)

## Active Edge Functions

These functions are actively maintained and use the correct Exa→Firecrawl pipeline:

### Data Import (Firecrawl-based)
- ✅ `fetch-zillow-agent-firecrawl` - Scrape single agent via Firecrawl
- ✅ `fetch-zillow-agent-firecrawl-json` - JSON extraction via Firecrawl
- ✅ `scrape-zillow-firecrawl` - Zillow scraping via Firecrawl
- ✅ `import-agents-firecrawl` - Bulk import via Firecrawl
- ✅ `import-agents-unified` - Unified Firecrawl-based import
- ✅ `import-agents-full-pipeline` - Full Exa→Firecrawl pipeline

### Exa Search
- ✅ `search-agent-exa` - Exa API agent search
- ✅ `test-exa-search` - Exa search testing

### Profile Synthesis
- ✅ `synthesize-agent-profile` - AI bio generation
- ✅ `rerun-press-synthesis` - Bulk re-synthesis
- ✅ `generate-agent-bios` - Bio generation

### Other Active Functions
- ✅ `create-agent-checkout` - Stripe payment processing
- ✅ `lookup-agent-license` - License verification
- ✅ `send-*` - Email/SMS functions
- ✅ `sync-*` - Pipedrive sync functions
- ✅ `warm-cache` - Cache warming
- ✅ `health-check` - Health monitoring

## Environment Variables Required
- `FIRECRAWL_API_KEY` - For Firecrawl scraping
- `EXA_API_KEY` - For Exa search/prequalification
- `APIFY_API_TOKEN` - **NO LONGER NEEDED** (can be removed)

## Benefits of Exa→Firecrawl Pipeline

1. **No Apify dependency** - Removes unreliable/deprecated actors
2. **Cost efficiency** - Firecrawl only runs on qualified agents
3. **Better reliability** - Exa prequalification filters bad leads early
4. **Simpler architecture** - Two clear steps instead of 5+ actors
5. **Easier maintenance** - Fewer integrations to manage
