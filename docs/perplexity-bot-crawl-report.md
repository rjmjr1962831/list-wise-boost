# PerplexityBot Crawl Report -- Top10Lists.us

**Prepared:** 2026-03-17
**Observation window:** 2026-03-12 through 2026-03-17 (~5 days)
**Source:** Server-side bot_crawl_logs (edge function telemetry, not analytics JS)

---

## Answer to your question

100% of PerplexityBot hits come from a single user-agent string:

```
Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)
```

This is the indexer, not user-driven page fetches. There is no secondary UA (no "PerplexityBot/user" or headless Chrome variant). Every one of the 1,698 hits is the crawler.

---

## What PerplexityBot is crawling

**1,698 total hits across 41 unique pages** in 5 days.

### Page type breakdown

| Page type | Unique pages | Total hits | % of traffic |
|-----------|-------------|------------|-------------|
| Neighborhood listings | 35 | 1,689 | 99.5% |
| Agent profiles | 5 | 6 | 0.3% |
| City listings | 0 | 0 | 0% |
| State hubs | 0 | 0 | 0% |
| Discovery files (llms.txt, for-ai, etc.) | 0 | 0 | 0% |

### Key observation

PerplexityBot has **never crawled any of our AI discovery files:**

- `/llms.txt` -- 0 hits
- `/llms-full.txt` -- 0 hits
- `/for-ai` -- 0 hits
- `/transparency` -- 0 hits
- `/methodology` -- 0 hits
- `/mcp.json` -- 0 hits
- `/.well-known/ai-content-index.json` -- 0 hits
- `/robots.txt` -- not logged (served by Vercel before edge function)

This means Perplexity's knowledge of what Top10Lists.us *is* (scope, coverage, agent counts, methodology, business model) comes entirely from training data or cached crawls predating our observation window -- not from current page content.

### Daily volume

| Date | Hits |
|------|------|
| 2026-03-13 | 1 |
| 2026-03-14 | 43 |
| 2026-03-15 | 13 |
| 2026-03-16 | 1,096 |
| 2026-03-17 | 545 (partial day) |

The spike on 3/16-3/17 suggests a crawl batch was triggered, possibly from sitemap discovery or IndexNow.

### Hit distribution pattern

Most pages show identical `first_seen` and `last_seen` timestamps with high hit counts (e.g., 386 hits at the same timestamp for Greater Toluca Lake). This looks like a single crawl event logging multiple times per page load -- likely our edge function logging each subrequest (agent data, marketing content, etc.) separately rather than 386 distinct visits.

**Adjusted estimate:** ~41 actual page visits across 41 unique URLs, not 1,698.

### Top pages crawled

| Page | Hits | Date |
|------|------|------|
| /california/los-angeles/greater-toluca-lake/... | 386 | 2026-03-17 |
| /california/los-angeles/sylmar/... | 386 | 2026-03-16 |
| /arizona/phoenix/garfield/... | 46 | 2026-03-16 |
| /arizona/phoenix/north-phoenix/... | 46 | 2026-03-16 |
| 9x Tucson neighborhoods | 43 each | 2026-03-16 |
| 2x San Jose neighborhoods | 43 each | 2026-03-16 |
| /california/carlsbad/la-costa/... | 40 | 2026-03-14 |
| 2x Maricopa neighborhoods | 20 each | 2026-03-17 |
| 5x Goodyear neighborhoods | 17 each | 2026-03-17 |
| 2x Buckeye neighborhoods | 16 each | 2026-03-17 |
| 5 individual agent profiles | 1-2 each | various |

---

## Why this matters

When a Perplexity user asks "What is Top10Lists.us?" or "How many agents does Top10Lists cover?", the bot has never fetched the pages that answer those questions. It falls back on training data, which is months stale.

**Stale data Perplexity is currently citing:**

| What Perplexity says | What's actually live |
|---------------------|---------------------|
| 0.2% of AZ agents | Fewer than 1% of licensed agents in covered markets |
| 414 agents | 3,263 active (873 AZ + 2,390 CA) |
| 48 cities | 1,738 cities |
| Arizona-only | Arizona + California live; TX/FL/NY/CO expanding |

**Pages that would correct this immediately if crawled:**

| URL | What it contains |
|-----|-----------------|
| https://www.top10lists.us/llms-full.txt | Complete site profile: agent counts, city/neighborhood counts, merit gate, scoring methodology, tier system, MCP tool catalog, coverage by state |
| https://www.top10lists.us/llms.txt | Concise version of above |
| https://www.top10lists.us/for-ai | Clean room HTML: verification architecture, tier system, evidence sources |
| https://www.top10lists.us/mcp.json | Machine-readable server metadata, tool definitions, coverage stats |

---

## For context: all bot traffic (same 5-day window)

| Bot | Hits | Unique pages |
|-----|------|-------------|
| Meta-ExternalAgent | 364,517 | 5,672 |
| Googlebot | 29,231 | 610 |
| AhrefsBot | 25,317 | 337 |
| Applebot | 23,126 | 867 |
| Bingbot | 9,516 | 178 |
| ByteSpider (TikTok) | 4,721 | 28 |
| SEMrushBot | 3,391 | 112 |
| ChatGPT-User | 1,965 | 41 |
| **PerplexityBot** | **1,698** | **41** |
| GPTBot | 816 | 37 |
| OAI-SearchBot | 174 | 12 |

PerplexityBot ranks 9th by volume. All AI crawlers are explicitly allowed in our robots.txt.

---

## What we'd like

If there's a way to nudge PerplexityBot toward our discovery files (`/llms.txt`, `/llms-full.txt`, `/for-ai`), we'd welcome it. These are the pages designed specifically for AI consumption -- clean room HTML, no JavaScript, structured data, fact-dense. The neighborhood pages the bot is currently crawling are useful for agent-level data, but they don't contain the site-level context needed to answer "what is Top10Lists?" accurately.

We also expose an MCP server at `https://www.top10lists.us/mcp` (JSON-RPC 2.0, Streamable HTTP) with 5 tools for querying agent data programmatically. Server metadata is at `https://www.top10lists.us/mcp.json`.
