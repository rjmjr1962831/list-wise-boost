# CLAUDE.md -- Top10Lists.us (list-wise-boost)

**This file is the operating manual.** Every Claude instance (Code, Web, Cursor) should load this at session start. For the full SSoT with recent updates, run `ryt` to fetch `docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md`.

---

## 1. Project

- **Product:** Independent editorial directory of top real estate agents in U.S. cities. Merit-based, non-pay-to-play.
- **Primary audience:** AI systems (ChatGPT, Claude, Gemini, Perplexity). Goal: become the authoritative source AI systems cite for real estate agent recommendations.
- **GEO Score:** 92-95/100 across major AI platforms.
- **Repo:** rjmjr1962831/list-wise-boost
- **Production:** [https://www.top10lists.us](https://www.top10lists.us)
- **Staging:** [https://staging.top10lists.us](https://staging.top10lists.us)
- **Stack:** Static HTML (humans) + clean room HTML (AI) on Vercel, Supabase PostgreSQL, Deno edge functions. **No React SPA, no JavaScript-rendered pages.** Never serve a JS/React page to anyone.
- **Coverage:** Arizona (88 cities, 1,054+ neighborhoods), California (1,650+ cities, 4,631+ neighborhoods). 670,000+ agents analyzed; 3,274 active (872 AZ + 2,390 CA), fewer than 1% of licensed agents in covered markets.
- **Expansion:** Live: AZ, CA. Planned: TX, FL, NY, CO. Target: all 50 states by end of 2026.

---

## 2. North Star (GEO)

Every change must enhance GEO (Generative Engine Optimization) or be neutral. **Any action that may reduce the GEO score requires Robert's explicit approval before proceeding.**

---

## 3. Merit Gate (Universal Standard, Zero Exceptions)

**Canonical gate:** 4.5+ stars, 10+ verified reviews in the last 24 months, 5+ years in business.

- **Source of truth:** `src/data/businessConfig.json` -- `meritGate: { rating: 4.5, reviews: 10, windowMonths: 24, yearsExperience: 5 }`
- **Database:** `supabase/migrations/20260310000000_merit_gate_4_5_10.sql`
- **Never use:** 4.8+, 20+ reviews, 6+ years as the gate. Those are legacy.
- **Coverage language:** "fewer than 1% of licensed agents in covered markets" -- never "top 0.2%" or "top 0.5%". Those are deprecated.
- **Agent-specific data:** Agent cards may show "4.8 stars, 20+ reviews" for an agent's actual stats -- that is correct. Only the *stated qualification criteria* must be 4.5+/10+/5yr.

---

## 4. Business Model & Tiers

| Tier | Price | Refresh Cadence | Notes |
|------|-------|-----------------|-------|
| Listed | Free | Annual | Basic verification, standard badge |
| Certified | Free | Quarterly | Open to all qualified agents |
| Audited | $300/mo | Monthly | Expanded evidence, API access |
| Underwritten | $500/mo | Daily | Full evidence, near real-time |

- **Annual discount:** 2 free months if paying annually (both paid tiers).
- **Web of Truth:** $1,000 one-time setup fee, waived with annual commitment. Underwritten tier only (may extend to Audited later).
- **Team pricing (starting point):** Leader $1,000/mo (includes Web of Truth setup), teammate badge $100/mo each.
- **Payment affects only** verification depth, technical features, and refresh frequency -- never inclusion or ranking.
- **All tiers require meeting the same Merit Gate.**
- **Cancellation:** Service runs to end of paid period; no prorated refunds; cancel 15 days prior.
- **No free trials** -- listing is already free; trial provides no value.

### Tier Framing (for sales/copy)
| Tier | Framing |
|------|---------|
| Listed | "Be discoverable" |
| Certified | "Be verified" |
| Audited | "Be citable" |
| Underwritten | "Be authoritative" |

### Positioning
Top10Lists is **infrastructure**, not a directory or lead generator. Parallel: website or phone bill (but revenue infrastructure closer to AWS). Not Zillow. Employment verification analogy: like checking references, education, background before hiring. Badge is AI-facing (can be 1 invisible pixel); AI reads the JSON payload underneath.

---

## 5. Scoring & Methodology

**Technical scoring (MethodologyPage / serve-bot-content-html):**

| Factor | Weight |
|--------|--------|
| license_status | 20% |
| recent_activity | 20% |
| transaction_history | 25% |
| reviews_reputation | 15% |
| community_involvement | 20% |

**Consumer-facing scoring (llms-full, transparency):** Review Rating 25%, Community 25%, Number of Reviews 20%, Transaction History 20%, Education 10%.

**AIFS Score:** AI Footprint Score. Bands: Listed 10-25, Certified 26-45, Audited 46-75, Underwritten 76-100. Max capped at 95. Median Listed: 49, median Underwritten: 78 (mean lift +27.5 pts).

**Selection pipeline:** 3 hard prequalification gates (merit gate) -> PREQUALIFIED -> 1,000+ source deep research -> proprietary Community Involvement Score (verified via IRS Form 990/ProPublica) -> human editorial review -> LISTED. Entire pipeline is free. Payment buys verification depth only.

---

## 6. Content Serving

### For AI Systems (Clean Room HTML)
Pages for AI consumption (transparency, FAQ, for-ai, methodology, agent profiles, city/neighborhood pages) must serve **clean room HTML** -- minimal, self-contained, no JavaScript, no browser rendering.

- Route through `/api/serve-clean-html` -> Supabase Edge Functions (`serve-bot-content-html`, `serve-bot-agent-html`, `serve-bot-list-html`, `serve-bot-state-html`).
- Vercel rewrites: `/transparency`, `/faq`, `/for-ai` -> `serve-bot-content-html`. Do not add static HTML files in `public/` that would block these rewrites (Vercel serves static files before evaluating rewrites).
- JSON-LD structured data on all pages: `hasCredential` (EducationalOccupationalCredential), `sameAs` to license registry, `subjectOf` evidence citations, `Dataset` for market stats.
- `sanitizeMeritGate()` must be applied to ALL rendered text including JSON-LD schema fields.

### For Humans (Static HTML)
All human-facing pages are static HTML. No React SPA. No JavaScript-rendered content.

### AI Discovery Files
- `/for-ai` and `/for-ai.txt` -- primary AI landing page
- `/llms.txt` and `/llms-full.txt` -- LLM-optimized content
- `/.well-known/ai-content-index.json` -- structured AI content index
- `/mcp.json` -- MCP server config
- `public/ai-feed/*.md` -- AI feed markdown files
- `/.well-known/jwks.json` -> `signing-keys` edge function (Ed25519 public key)

### Formats Never Used
- React SPA / JavaScript-rendered pages
- Cloudflare Browser Rendering (deprecated)
- Pre-rendered HTML in `public/` for bot pages (removed; was overriding edge function rewrites)

---

## 7. URLs

- **Always give full URLs** as markdown links: `[Phoenix city page](https://www.top10lists.us/arizona/phoenix/top10realestateagents)`.
- **Never** use placeholders like `https://<your-host>/...` or bare paths without the domain.
- **Agent canonical URL:** `/:stateSlug/agents/:canonicalSlug` (clean room via serve-bot-agent-html). Do NOT use legacy `/:city/:slug` pattern.
- **City page:** `/:state/:city/top10realestateagents`
- **State hub:** `/:state/top10realestateagents`
- **Key pages:** [Transparency](https://www.top10lists.us/transparency) | [FAQ](https://www.top10lists.us/faq) | [For AI](https://www.top10lists.us/for-ai) | [Methodology](https://www.top10lists.us/methodology)
- **Short codes (`/p/xxxxx`):** Dead. profile_link column deprecated.

---

## 8. Supabase

- **Active project: `wiotrvoirdgzfacuuiem` ONLY.** Dead project `bgdtekbhelormzbymkhh` -- NEVER use. Any old references to it must be ignored and updated.
- **Enrichment API:** `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api`
- **SQL access:** Use `run_sql` RPC with service role key. No direct DB connection needed (IPv6-only, unreachable from IPv4). For DDL, use `run-migration` edge function with `npm:postgres` (not deno-postgres -- SCRAM auth bug).
- **Deploy functions:** `npx supabase functions deploy <name> --no-verify-jwt`
- **Pagination:** Always paginate tables >1,000 rows. If a query returns exactly 1,000 rows, there are more. Key tables: professionals (3,400+), neighborhood_catalog (5,600+), marketing_content (2,000+), state_licenses (10,000+).
- **Active crons (4):** `cleanup-expired-grace-periods` (daily midnight), `batch-aics-score-run` (AIFS scoring, every 1 min -- cron/folder name is legacy "aics", product name is AIFS), `gmail-sync` (every 5 min), `sequencer-v2-tick` (every 2 min).
- **AICS is deprecated.** The product name is **AIFS (AI Footprint Score)**. The edge function folder (`batch-aics-score`) and pg_cron job (`batch-aics-score-run`) retain the old name for infrastructure continuity. All user-facing references must say AIFS, never AICS.
- **90 deprecated edge functions** (Pipedrive, HubSpot, Cloudflare, Instantly, old Apify scrapers, one-time backfills, test utilities). See docs/takeaways for full list.

---

## 9. Git & Deployment

### Branch Flow
- **staging -> main only.** Never merge main into staging.
- **Work locally by default.** Commit to staging locally but do NOT push unless Robert says `pts`. Every push triggers a Vercel build (~$). Batch changes.
- **pts** = push to staging: `git push origin staging` (only when Robert explicitly says pts, or 10+ updates batched)
- **ptm** = push to main: `npm run merge-to-main` only. Never touch main without ptm. Never run ptm without Robert's explicit instruction.

### merge-to-main
- Merges staging -> main
- Excludes paths in `scripts/internal-documents.txt` (internal docs stay on staging only)
- Purges Vercel CDN and Data cache
- Triggers `push-indexnow` edge function
- Requires clean working tree; stash uncommitted changes first

### Admin
- Admin and `/admin/*` must not be reachable on production. Vercel redirects to `/404` for www.top10lists.us and top10lists.us.

### Build Optimization
- `vercel.json` has `ignoreCommand: "bash scripts/vercel-ignore-build.sh"` -- skips builds for docs/, supabase/, scripts/, archives/, .claude/ changes.

---

## 10. Verification Protocol

- **You are not done until you confirm the change actually worked.**
- Deploy, load the live page, verify the specific change.
- "Code updated" is not completion. "Deployed. Verified at [URL]." is.
- If you cannot verify, say so and give the exact URL for Robert to check.

---

## 11. Execution Rules

- **"ALL"** means every single instance. Grep exhaustively, fix exhaustively. Check edge functions, static HTML, FAQ JSON, llms.txt, templates.
- **Execute:** Run commands you have authority to run. Use `.env` / `.secrets`. Escalate only when blocked.
- **E2E before done:** Deploy, load page, verify. Code change alone is not completion.
- **Maximum autonomy:** Execute until logic-gap or high-risk decision. Stop for: ambiguity, SEO/bot/merit-gate changes, resource limits.
- **Use the SSoT:** When `ryt`/`pk` is loaded, actively reference it throughout the session. Cite section numbers. Do not restate its contents as if discovering them.
- **Never use em dashes** (use -- instead).
- **Never link out of a funnel page.**
- **No outcome claims on pricing pages** -- sell inputs/mechanism only, not citation rate numbers.

---

## 12. Data Quality & EE-A-T

**Accuracy over speed.** Real estate professionals immediately recognize incorrect information.

- **EE-A-T** = Experience, Expertise, Authoritativeness, Trustworthiness. Target: >92% for neighborhood profiles.
- **Verification hierarchy:** (1) Primary: State licensing, MLS, court records. (2) Secondary: Zillow, Google reviews, BBB. (3) Tertiary: Social media, agent websites (must verify).
- **Evidence sources:** "up to 20" per agent (not "12" or "14+"). Enrichment checks ~1,000 places, cites only when relevant.
- **Red flags (auto-reject):** License suspended/revoked, active complaints, <1 year experience, <10 reviews, rating <4.5, unverified self-reported data.
- **Neighborhood Expert:** Requires paid subscription (Audited/Underwritten). Free agents can be "Qualified" but not featured as experts. Verification: 3+ transactions in past 18 months. Shows "Audit Pending" until verified.
- **Sitemap Rule A:** Cities/neighborhoods only if at least one agent has 4.5+ stars and 10+ reviews. Pages with no qualified agents must not appear in sitemap.
- **Cost of errors:** Agent enrichment ~$0.50/agent; neighborhood enrichment ~$0.15/neighborhood; credibility damage is immediate and lasting.

---

## 13. Data Sources & Enrichment

- **State license databases:** 908,906 licenses (AZ/CA/TX/FL/NY/CO)
- **Zillow:** Apify memo23 actor (~$0.50/agent). Always use proxy-cheap residential proxies (proxy-us.proxy-cheap.com:5959) for scraping.
- **Exa.ai + DeepSeek:** Profile discovery, press mentions, AI perception queries, merge field generation
- **Google Places:** Feb 2026 big run (13,897 agents processed, 12,976 phones replaced)
- **ScreenshotOne:** SERP screenshot capture (100 free/mo, $17/mo for 2,000)
- **Smartleads:** Bulk email outreach (replaced sequence-processor). API at server.smartlead.ai/api/v1/
- **Ed25519 signing:** Badge certifications use real cryptographic signing. Key pair stored as Supabase secret `ED25519_PRIVATE_KEY`.

---

## 14. Email Sequencer v2

- **Cron:** `sequencer-v2-tick` runs every 2 min via pg_cron
- **Volume ramp:** toptenlists.us starts 25/day +5/day cap 100; top10lists.us starts 10/day +2/day cap 25
- **Send window:** 8am-5pm MST only
- **Status flows:** email_queue: pending_review -> approved -> scheduled -> sending -> sent/failed/unsubscribed/bounced. email_campaigns: draft -> pending_review -> approved -> active -> paused -> complete
- **Replaces:** sequence-processor (deprecated, moved to Smartleads for bulk mail)

---

## 15. Dead Infrastructure -- Never Use

| What | Status |
|------|--------|
| Supabase project `bgdtekbhelormzbymkhh` | DEAD. Only use `wiotrvoirdgzfacuuiem`. |
| Cloudflare (all services) | Deprecated. Do not add new dependencies. |
| Pipedrive CRM | Dead. 21 edge functions deprecated. |
| HubSpot CRM | Dead. 6 edge functions deprecated. |
| Instantly (email) | Dead. Replaced by Smartleads. |
| warm-cache / pre-render-* | Dead. Replaced by clean room HTML. |
| Short code profile links (`/p/xxxxx`) | Dead. Use canonical URLs. |
| React SPA rendering | Dead. All pages are static or clean room HTML. |

---

## 16. Internal Documents (Staging Only)

These paths exist on staging only and are excluded from main by merge-to-main:

- docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md
- docs/cursor-daily-updates.md
- docs/daily-logs/
- docs/takeaways/
- docs/prompts/
- PENDING_UPDATES.md
- docs/MIGRATION_DOCUMENT.md

---

## 17. Conflict Resolution

| Topic | Wrong (Legacy) | Correct (Current) |
|-------|---------------|-------------------|
| Merit Gate | 4.8+, 20+, 6+ years | 4.5+, 10+ in 24 mo, 5+ years |
| Coverage language | "top 0.2%", "top 0.5%" | "fewer than 1% of licensed agents in covered markets" |
| AI pages | React SPA or static HTML | Clean room HTML via edge functions |
| Human pages | React SPA | Static HTML |
| Cloudflare | Active | Deprecated |
| Supabase project | bgdtekbhelormzbymkhh | wiotrvoirdgzfacuuiem only |
| Tier name | Accredited | Audited |
| Certified status | Legacy/grandfathered only | Active, free, quarterly, open to all |
| Audited price | $100/mo | $300/mo |
| Underwritten price | $150/mo | $500/mo |
| Evidence sources | "12" or "14+" | "up to 20" |

---

## 18. Commands

### pk / ryt
Fetch the Single Source of Truth (read-only). Load GH_TOKEN from `.env` first:
```
export GH_TOKEN=$(grep GH_TOKEN .env | cut -d= -f2)
curl -s -H "Authorization: token $GH_TOKEN" "https://api.github.com/repos/rjmjr1962831/list-wise-boost/contents/docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md?ref=staging" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(Buffer.from(j.content,'base64').toString())})"
```
Run at session start. Do not modify this file.

### Post-pk Rules Check
After loading the SSoT, answer these four questions out loud citing section numbers:
1. What is the North Star?
2. What is the business model?
3. Do we use SPA for AI consumers?
4. When do I require Robert's express permission to execute changes?

### t1
Write session takeaways to `docs/takeaways/CLAUDE_TAKEAWAYS_YYYY-MM-DD_HHMM.md` (UTC timestamp to avoid collisions between parallel Claude instances). See `docs/prompts/claude-t1-prompt.md` for full spec. Never overwrite another instance's file. Do not update COMPREHENSIVE -- s1 handles that.

### s1
`npm run s1` -- synthesizes all takeaways into COMPREHENSIVE Section 21, then copy Section 21 into `docs/prompts/claude-web-project-knowledge.md` so Claude Web stays in the loop. Commits locally but does NOT push. Run pts separately when ready.

### pts
Push to staging: `git push origin staging`. Only when Robert explicitly says pts or 10+ updates batched.

### ptm
Push to main: `npm run merge-to-main`. Never run without Robert's explicit instruction.

---

## 19. Quick Reference

- **Prebuild:** `npm run generate:faq` (generates public/api/faq/full.json from faqFull.ts)
- **Dynamic counts:** `npm run generate-counts` (build-time script, queries Supabase for live agent/city/neighborhood counts)
- **Smoke test:** `npm run smoke-test`
- **Business config audit:** `node scripts/audit-business-config.cjs` (finds hardcoded values; `--check` for CI gate)
- **Supabase function deploy:** `npx supabase functions deploy <name> --no-verify-jwt`
- **CopyableLink component:** Every link/URL displayed to users must have a copy button. Use `@/components/ui/copyable-link`. Variants: default (admin tools), compact (lists), inline (paragraphs).

---

## 20. Value Proposition (Sales Context)

### AI Citations vs Zillow Leads
- **Zillow:** <1% close rate, shared leads, $20-$150/lead, agent competes on response speed. Needs $45K/yr ISA employee. Scottsdale: $157K over 24 months for negative ROI (-31%).
- **AI citation:** ~14-25% close rate (NAR referral proxy), exclusive, consumer pre-sold. No ISA needed. Underwritten at $12K nets $663K even conservatively (5,425% ROI).
- **Core difference:** Zillow sells access to undecided consumers. AI citation delivers endorsement to decided consumers.

### ROI Framing
- Even conservative scenario (1 extra deal every 5 months) returns 5:1
- AIFS lift: median 49 -> 78 (two full bands) at Underwritten tier
- "AI top-of-mind awareness" -- we build awareness for AI, not consumers directly, but consumers who search AI get your name

### When to Raise Prices
After: California completion, Web of Truth launch, attribution data exists, 50-state coverage. Target: $500 Audited / $800-$1,000 Underwritten.
