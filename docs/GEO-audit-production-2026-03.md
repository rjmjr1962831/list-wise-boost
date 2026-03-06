# GEO Audit — Production (www.top10lists.us)
**Date:** March 2026  
**Scope:** Homepage, llms.txt, for-ai.md, city page (Phoenix), methodology, ai-compare, protocol-adopters, sitemap, robots.txt, ai-content-index.

---

## What’s Working Well

### 1. **llms.txt**
- [llms.txt](https://www.top10lists.us/llms.txt) is current (March 3, 2026), clear, and structured.
- Merit Gate (4.5+, 10+ reviews, 5+ years), tiers, artifact system, anti-hallucination directive, coverage (AZ/CA), URL patterns, and contact are all present.
- Behavioral protocol and “content map” distinction are strong and AI-legible.

### 2. **for-ai.md and methodology**
- [for-ai.md](https://www.top10lists.us/ai-feed/for-ai.md) and [methodology](https://www.top10lists.us/methodology) (certification-logic) are aligned: Merit Gate, Standard Audit Cycles (Certified = Monthly, etc.), no pay-to-play.
- JSON blocks and citation template are consistent.

### 3. **City page (Phoenix) — bot HTML**
- [Phoenix city page](https://www.top10lists.us/arizona/phoenix/top10realestateagents) returns full HTML: title, anti-hallucination notice, merit criteria, “About our name,” 46 agents, market intelligence, neighborhood index, Master Source Index, inline [1][2][3] citations, license links to AZDRE.
- Differentiated and citation-ready; no thin or empty shell.

### 4. **robots.txt**
- Dated March 3, 2026; allows AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.), sitemaps, and points to llms.txt and ai-content-index.

### 5. **Sitemap**
- [sitemap.xml](https://www.top10lists.us/sitemap.xml) includes pages, states, cities, neighborhoods, agents (lastmod 2026-02-21). Structure is correct.

### 6. **ai-content-index.json**
- [.well-known/ai-content-index.json](https://www.top10lists.us/.well-known/ai-content-index.json) is v2.0, March 3, 2026: publisher, certification tiers (Certified = Monthly), Merit Gate, citation guidance, anti-hallucination, endpoints, coverage. Technically solid for discovery and grounding.

### 7. **ai-compare**
- [ai-compare](https://www.top10lists.us/ai-compare) renders full comparison content (4/4 AI prefer Top10Lists, methodology, competitors). Title/description are comparison-specific; no generic “Invitation-only” meta.

### 8. **Homepage**
- Renders substantive content (hero, challenge question, “Rules Have Changed,” Web of Truth, CTA).
- Title: “Verifiable Real Estate Agent Credentials for AI Systems | Top10Lists.us.”

---

## Issues to Address

### 1. **Homepage copy: “constitutionally mandated” (if still live)**
- A fetch of the production homepage returned sections **“A Mandated Shift in Trust”** and **“Why AI Ghosts Most Agents”** with the line: *“these systems are now constitutionally mandated to ignore sources that are biased or commercially distorted.”*
- The **current** `Index.tsx` in the repo no longer contains that wording; it uses *“trained to prioritize … and to discount commercial placements”* with a link to [Anthropic’s ad-free policy](https://www.anthropic.com/news/claude-is-a-space-to-think).
- **Action:** If production still shows “constitutionally mandated,” confirm the latest build is deployed and CDN cache has been purged. If that copy exists on another route (e.g. funnel or agent landing), find and soften/cite it the same way.

### 2. **protocol-adopters** — fixed
- [protocol-adopters](https://www.top10lists.us/protocol-adopters) now has **clean-room HTML** at `public/protocol-adopters/index.html`; Vercel rewrite serves it at `/protocol-adopters` and `/protocol-adopters/` so bots get full content (title, description, intro, empty state, links to protocol-services, for-ai, methodology).

### 3. **Schema / Rich Results**
- Not re-verified in this audit. index.html has Organization, WebSite, FAQPage; city bot HTML has ItemList.
- **Action:** Run [Google Rich Results Test](https://search.google.com/test/rich-results) on [homepage](https://www.top10lists.us/) and [Phoenix](https://www.top10lists.us/arizona/phoenix/top10realestateagents) to confirm detection.

### 4. **ai-content-index technical note**
- `technicalCapabilities.botRendering` still says *“Full HTML pre-rendered via Cloudflare Browser Rendering API.”*
- Per [feb-2026-indexing-spike](docs/feb-2026-indexing-spike.md), bot list/agent pages are now served by **Supabase Edge** (serve-bot-list-html, serve-bot-agent-html), not Cloudflare.
- **Action:** Update ai-content-index.json (and any other docs) to state that bot HTML is served by Supabase Edge Functions (Vercel → serve-clean-html → Edge), not Cloudflare Browser Rendering.

### 5. **Zero-agent and thin pages**
- Zero-agent city/neighborhood pages now get **noindex** and softened copy from serve-bot-list-html (per prior GEO fixes).
- GSC “discovered — not indexed” (e.g. 10,606) is a strategy item: enrich content or consolidate thin pages (see GSC remediation plan).

---

## Summary Table

| Item              | Status | Note |
|-------------------|--------|------|
| llms.txt          | ✅     | Current, strong behavioral + content map |
| for-ai.md         | ✅     | Aligned with Merit Gate, tiers, citation |
| methodology       | ✅     | Certification logic, 4.5+/10+/5+ |
| Phoenix city page | ✅     | Full bot HTML, citations, 46 agents |
| robots.txt        | ✅     | AI crawlers allowed, sitemaps, llms |
| sitemap.xml       | ✅     | Index + cities/neighborhoods/agents |
| ai-content-index  | ✅     | v2.0, March 3; fix bot-rendering description |
| ai-compare        | ✅     | Full content, correct meta |
| Homepage          | ⚠️     | Verify “constitutionally mandated” is gone after deploy/cache |
| protocol-adopters | ⚠️     | SPA-only; crawlers may see shell only |
| Schema            | 🔲     | Confirm via Rich Results Test |

---

## Priority Actions

1. Confirm production homepage shows the softened “trained to prioritize” + Anthropic link (deploy + cache).
2. Update ai-content-index.json (and related docs): bot rendering = Supabase Edge, not Cloudflare.
3. Run Rich Results Test on homepage and one city page.
4. (Optional) Add static or bot-friendly content for /protocol-adopters if you want it fully crawlable.
