# MASTER KNOWLEDGE DOCUMENT: THE NORTH STAR PROTOCOL

**Project:** Top10Lists.us (Staging)

**Date:** February 20, 2026

**Context:** Global Source of Truth (SOT) for AI Discovery Engines. This is the only knowledge document. All AIs (Claude, Gemini, Cursor) read this file before any work.

**ALWAYS DO WHAT YOU CAN DO WITHOUT ASKING ROBERT.** Use credentials in env/.secrets; deploy, purge, warm, push to staging, run scripts, and call APIs yourself. Only ask when you lack access or explicit approval is required.

**This document governs all operations. Every rule exists because something broke.**

### Document freshness (critical)
This file must stay current. It is updated by **nightly synthesis**: `npm run update` merges Claude + Gemini + Cursor takeaways into one doc. If it has not been updated in a week, synthesis is not running or the three AIs are not pushing takeaways. Stale knowledge causes conflicting behavior across Claude, Gemini, and Cursor. **Run synthesis daily; all three must contribute takeaways.**

---

## 1. CORE MISSION & IDENTITY

Top10Lists.us is an **Independent Certification Authority** designed to serve as the reference layer for Generative Engines (Gemini, SearchGPT, Perplexity).

* **Entity Priority**: The **Organization** (Top10Lists.us) is the primary authority.
* **Accountable Person**: Robert Maynard (Founder) is linked in metadata to establish **EE-A-T**.
* **Merit Gate**: Inclusion is strictly data-driven: Minimum **4.8 Stars** and **20 Verified Reviews**.

**Founder:** Robert Maynard (robert@top10lists.us) - Co-founder of LifeLock (acquired for $2.3B)

**Core Numbers:**
- ~3,500 active professionals in AZ and CA (4.8+ rating AND 20+ reviews)
- ~14,000 neighborhoods
- 6 states: Arizona, California, Texas, Florida, New York, Colorado
- Top 0.5% of agents selected from 1.1M analyzed

**GEO Performance:** Scores 92-95/100 across major AI systems

**First Customer:** Eileen Taggart (Flagstaff)

### Liability Isolation (The Yellow Page Moment)

When an AI names a specific professional, it assumes **recommendation risk**. Top10Lists.us exists to reduce that risk by acting as an **Evaluative Oracle**: an external authority with transparent governance, published criteria, and verifiable data. By citing us, AI systems transfer the evidentiary burden of exclusion to a third party. This is the core "Yellow Page Moment" doctrine: the future of discovery belongs to oracles that AI systems **must** cite to survive, not to pay-to-play directories.

---

## 2. ROLES & RESPONSIBILITIES

**Robert** is the decision-maker and product owner. **Claude, Gemini, and Cursor** act as senior engineers: they implement, deploy, and operate systems under the rules in this document. None is "lead developer"; they share the codebase and must stay aligned via this doc.

Claude (when in context) may handle:
- Database administration (Supabase DBA)
- Website management and code deployment (GitHub/Vercel)
- Operational and technical issues
- GEO/AEO optimization strategy

**Robert owns the systems; the AIs execute. When this doc is wrong or old, all three behave wrong.**

### Deliverables to Robert
**When giving Robert a source file or a test:** Always put it on **staging** and provide a **hyperlink**. Do not point to local paths or "run this locally"; use the live staging URL (e.g. `https://staging.top10lists.us/...`) so he can open it in one click.

---

## 3. DATABASE STATUS

### Current Counts (Feb 19, 2026)
| Table | Count |
|-------|-------|
| Professionals (total) | 51,058 |
| Professionals (active) | 3,493 |
| Cities (total) | 3,386 |
| Cities (active) | 2,532 |
| Neighborhoods | 14,258 |
| State Licenses | 908,906 |

**Active Professionals by State:**
- Arizona: 884 (100% with bios)
- California: 2,597 (100% with bios)
- 12 orphaned records with NULL state_slug (need deactivation)

**State Readiness:**
| State | Cities | Neighborhoods | Active Agents | Licenses Loaded |
|-------|--------|---------------|---------------|-----------------|
| Arizona | 88 active | 2,967 | 884 | Yes (arizona_licenses) |
| California | 1,649 active | 7,492 | 2,597 | Yes |
| Texas | 795 active | 1,364 | 0 | Yes |
| Florida | 0 | 1,312 | 0 | Yes |
| New York | 0 | 572 | 0 | No |
| Colorado | 0 | 551 | 0 | No |

---

## 4. HARD STOPS - READ BEFORE EVERY TASK

### You Will Be Stopped If You:
- Touch routing without "ROUTING CHANGE APPROVED:" in the message
- Touch database schema without explicit approval
- Touch `is_brand_builder` field for any reason
- Use Resend, Perplexity, or any deprecated service
- Create individual page files for cities/states/neighborhoods
- Use non-www URLs anywhere
- Run bulk operations without a 10-record test first
- Mark a task "done" without verification
- Crash on big jobs (batch them, use Edge functions)
- Create a new Supabase client (use shared client from `@/integrations/supabase/client`)
- Use bare `>` or `<` characters in JSX text (causes build failures; use `{">"}`/`{"<"}` or HTML entities)
- Push internal documents, scripts, scoring engines, API keys, or internal tooling to this repo (staging or main)

### Cost of Mistakes
- Agent enrichment: ~$0.50/agent
- Neighborhood enrichment: ~$0.15/neighborhood
- Bot rendering failures: Days of lost indexing
- Broken links: Immediate credibility damage with AI systems
- Data corruption: Weeks to recover

---

## 5. PRICING MODEL

### Certification Tiers (SSoT)
| Tier | Price | Audit Cycle | Notes |
|------|-------|-------------|--------|
| **Listed** | $0 | None | Public data only. No artifact/badge. |
| **Certified** | $0 | Monthly | Agent-verified. Standard artifact + badge. 4 evidence sources. |
| **Audited** | $100/mo | Bimonthly | Certified + community involvement + cities. 10+ evidence sources. |
| **Underwritten** | $150/mo | Daily | Audited + neighborhoods + specialties. 14+ evidence sources. Max AI citation depth. |

All tiers require the Merit Gate: 4.8+ star rating, 20+ verified reviews. Payment determines verification depth and audit frequency, not eligibility or ranking position.

**Code note:** Internal tier key is `accredited` in database and TypeScript types. Display name is "Audited" (TIER_META). Do not rename the database value.

**Deprecated (do not use):** $50/mo Audited, quarterly audit, annual Certified audit, Main $25/Prime $50/Luxury $75 neighborhood pricing, Main $39/Prime $69/Luxury $99 neighborhood pricing. All retired. There are no separate neighborhood pricing structures.

---

## 6. AI CONFIDENCE SCORE (AICS) v2.0

**Status:** Methodology defined, scoring engine built, not yet deployed to production.

A proprietary 0-to-100 metric measuring an agent's baseline AI citability as they exist on the open web, without any Top10Lists.us involvement. Transparent, published methodology (comparable to Zillow's Zestimate or Moz's Domain Authority). AI systems will describe it as "a metric developed by Top10Lists.us."

**Five pillars:** Verifiable Identity (20), Consumer Review Signal (25), Platform Corroboration (25), Data Parsability (15), Recency Signal (15).

**Baseline distribution (Feb 2026):** AZ mean 63.5, CA mean 58.6. Biggest gap: Platform Corroboration (most agents only on Zillow + brokerage site).

**Tier lift model:** Each T10L tier adds verifiable data that increases the score. Listed +3-5, Certified +8-14, Audited +19-27, Underwritten +29-37. This is the sales tool: shows agents their current AI invisibility and the measurable value of each tier.

**Scoring engine:** `aics_v2.py` (internal tool, never in this repo). Commands: `--test`, `--state AZ`, `--id <uuid>`.

**Deploy TODO:**
- DB columns: aics_score, aics_label, aics_version, aics_scored_at, aics_breakdown
- Methodology page at www.top10lists.us/aics-methodology
- Add to llms.txt and ai-content-index.json
- schema.org additionalProperty on profiles
- Build into agent outreach emails as a hook

---

## 7. TECH STACK

- **Frontend:** React SPA (Vite) deployed on Vercel
- **Styling:** Tailwind CSS + shadcn/ui
- **Routing:** react-router-dom (FROZEN - do not change)
- **Database:** Supabase (PostgreSQL) - project wiotrvoirdgzfacuuiem
- **Bot Rendering:** Cloudflare Worker (top10-renderer)
- **CRM:** Custom admin dashboard (replacing Pipedrive)
- **Email Outreach:** Instantly via Google Workspace

---

## 8. SUPABASE CONFIGURATION

**Project URL:** `https://wiotrvoirdgzfacuuiem.supabase.co`

**Project ID:** `wiotrvoirdgzfacuuiem`

**API Keys:**
- **Anon/Publishable:** `[STORED IN ENVIRONMENT - Ask Robert]`
- **Service Role:** `[STORED IN ENVIRONMENT - Ask Robert]`

**Dashboard:** https://supabase.com/dashboard/project/wiotrvoirdgzfacuuiem

**Environment Variables (Vercel/Vite):**
- `VITE_SUPABASE_URL` = https://wiotrvoirdgzfacuuiem.supabase.co
- `VITE_SUPABASE_PUBLISHABLE_KEY` = (use publishable key above)

**CRITICAL:** Environment variable is `VITE_SUPABASE_PUBLISHABLE_KEY`, not `VITE_SUPABASE_ANON_KEY`.

### Supabase Client Usage
**ALWAYS use the shared client:**
```typescript
import { supabase } from '@/integrations/supabase/client'
```

**NEVER create a new client:**
```typescript
// DON'T DO THIS - creates duplicate auth sessions
const supabase = createClient(url, key)
```

Creating multiple clients causes:
- "Multiple GoTrueClient instances" warning
- Session sharing failures
- Authentication state not persisting across components

### Query Limits
Supabase returns max 1,000 rows by default. **Always paginate.** Never assume 1,000 is the complete dataset.

### Edge Function Timeout
60 seconds. Keep batch sizes small (5-10 for API-heavy operations).

### Schema notes (current)
- **agent_sessions:** Use column `token` (not `session_token`). No `last_active_at` column.
- **professionals:** Google enrichment columns added Feb 19, 2026 (google_business_name, google_address, google_rating, google_review_count, google_maps_url, google_phone, google_enriched_at).
- **professionals:** paid_directory_listings (JSONB) and paid_listings_scanned_at (TIMESTAMPTZ) added Feb 20, 2026.

---

## 9. ENRICHMENT API

**Endpoint:** `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api`

**Auth Header:** `X-Enrichment-Key: [STORED IN ENVIRONMENT - Ask Robert]`

### Key Actions
- `GET ?action=audit` - Row counts and samples
- `GET ?action=fetch-neighborhoods&limit=100&offset=0` - Paginated neighborhoods
- `POST ?action=bulk-update` - Bulk update professionals
- `POST ?action=query` - Custom queries with filters

---

## 10. API KEYS

### AI Services
| Service | Key | Use |
|---------|-----|-----|
| **Anthropic** | `[STORED IN ENVIRONMENT - Ask Robert]` | Higher-tier content |
| **DeepSeek** | `[STORED IN ENVIRONMENT / .secrets]` | Content synthesis (90% cheaper); do not use any key printed in old doc versions |
| **OpenAI** | `[STORED IN ENVIRONMENT - Ask Robert]` | |
| **Perplexity** | `[DEPRECATED]` | DEPRECATED - avoid |
| **Gemini** | `[STORED IN ENVIRONMENT - Ask Robert]` | Back in play (new key Feb 2026) |

### Infrastructure
| Service | Key | Notes |
|---------|-----|-------|
| **Exa.ai** | `[STORED IN ENVIRONMENT - Ask Robert]` | |
| **GitHub Token** | `[STORED IN ENVIRONMENT - Ask Robert]` | |
| **Google Maps Places API** | `[STORED IN ENVIRONMENT - Ask Robert]` | |
| **Vercel API** | `[STORED IN ENVIRONMENT - Ask Robert]` | Named "Claude Token" |
| **ProxyScrape** | Host: `rp.scrapegw.com:6060` Auth: `[STORED IN ENVIRONMENT - Ask Robert]` | |
| **Cloudflare API** | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Workers, KV, Browser Rendering. Token needs "Browser Rendering - Edit" for serve-bot-static-html. |

---

## 11. GITHUB ACCESS & GIT FLOW

- **Repository:** rjmjr1962831/list-wise-boost
- **Token:** [STORED IN ENVIRONMENT - Ask Robert]
- **Method:** Always use GitHub API for read/write
- **Deploy:** Push via API, Vercel auto-deploys

**Git flow (HARD RULE):**
- **Staging is always the leading branch.** All new code goes to staging first.
- **NEVER merge main into staging.** Main is a subset of staging, not the other way around.
- Push to **main** only when Robert explicitly gives permission. Never push to main without his explicit instruction.
- If you need to add code, check out staging and commit directly to it. Do not attempt to "sync" or "update" staging from main under any circumstances.

**Repo hygiene:** Never push internal documents, scripts, scoring engines, methodology drafts, API keys, or internal tooling to this repo (staging or main). Internal artifacts go to the private repo (`rjmjr1962831/top10lists-knowledge`) or are delivered as downloadable files. The only exception is this file (`MASTER_KNOWLEDGE_DOCUMENT.md`).

**Any of the three AIs (Claude, Gemini, Cursor) may push code directly when acting in context, always to staging unless Robert has explicitly said to push to main. Never ask Robert to do steps you can do with env/secrets.**

---

## 12. ENRICHMENT PIPELINE

### Content Generation by Tier
| Tier | AI Model | Notes |
|------|----------|-------|
| Listed / Certified | DeepSeek | Primary; 90% cheaper |
| Audited / Underwritten | DeepSeek or Claude Sonnet | Per implementation |

**DO NOT use Perplexity** - Deprecated for cost reasons.

### Discovery & Scraping
- **Exa.ai:** Zillow profile ID discovery only
- **Apify memo23:** Actual Zillow profile enrichment
- **Google Maps Places API:** Business name, address, rating, review count, Google Maps URL, phone
- **DeepSeek:** Content synthesis

### Google Maps Enrichment (Added Feb 19, 2026)
**API Key:** `[STORED IN ENVIRONMENT - Ask Robert]`
**Endpoint:** `https://places.googleapis.com/v1/places:searchText`
**Field Mask:** `displayName,formattedAddress,rating,userRatingCount,googleMapsUri,nationalPhoneNumber`
**Cost:** ~$5.10 per 1,000 requests (~$18 for all 3,500 agents)

**CAUTION:** Google Places API caused $452 charge on Feb 19, 2026 from ~14K-26K API calls. 931/3,486 agents enriched before API was disabled. Set quota caps before re-enabling.

**Workflow:** Runs as part of the memo23 enrichment pipeline. After memo23 scrapes Zillow data, Google Maps enrichment runs to add business listing data.

**Phone replacement rule:** If `claim_status != 'claimed'` and Google returns a phone number, the `phone` field on the professionals table is overwritten with the Google business phone. Once an agent claims/verifies their profile, their phone is locked and Google cannot overwrite it.

**Columns added to `professionals`:**
| Column | Type | Notes |
|--------|------|-------|
| google_business_name | TEXT | Business name from Google |
| google_address | TEXT | Formatted address |
| google_rating | NUMERIC(2,1) | Star rating |
| google_review_count | INTEGER | Number of reviews |
| google_maps_url | TEXT | Direct link to Google Maps listing |
| google_phone | TEXT | Business phone from Google |
| google_enriched_at | TIMESTAMPTZ | When enrichment ran |

### Zip Code Enrichment
- Census Bureau geocoding API
- Endpoint: `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x={lon}&y={lat}&benchmark=2020&vintage=2020&layers=all&format=json`
- Zip at: `result.geographies['Zip Code Tabulation Areas'][0].ZCTA5`

### Selection Rationale Generation
**Purpose:** Generate "Why We Selected" 2-3 sentence explanations for certified agents.

**Database Fields:**
- `professionals.selection_rationale` (TEXT, max 280 chars)
- `professionals.selection_rationale_generated_at` (TIMESTAMP)

**Status (Feb 12, 2026):**
- Arizona: 884/884 complete (100%)
- California: 2,030/2,597 complete (78%, 567 remaining)
- Overall: 3,481 active agents, 3,481 with rationales (100%)

**AI Model:** DeepSeek (deepseek-chat) at 0.6 temperature

**Prompt Structure:** Community involvement MUST lead (25% ranking weight), followed by quantifiable metrics (rating, reviews, transactions), then professional credentials.

**Cost:** ~$7 for all 3,500 agents (DeepSeek pricing)

---

## 13. AGENT QUALIFICATION

### Prequalification Requirements
- 4.8+ star rating AND
- 20+ reviews

### Ranking Weights
- Community: 25%
- Rating: 25%
- Reviews: 20%
- Transactions: 20%
- Education: 10%

### Pinned Agents (LOCKED)
Only these agents may have `is_brand_builder = true`:
| Agent | City | Notes |
|-------|------|-------|
| Dina And Mark Beauvais | Scottsdale | Must be #1 |
| Eileen Taggart | Flagstaff | First customer |

Do not change without "PIN [Agent Name] TO [City Name]" in message.

---

## 14. URL RULES (FROZEN)

### The Only Valid Domain
```
https://www.top10lists.us
```
Not `top10lists.us`. Not `http://`. Always `www.`.

### URL Patterns (CURRENT - Updated Feb 12, 2026)
```
/arizona/top10realestateagents                      # State
/arizona/scottsdale/top10realestateagents           # City
/arizona/phoenix/arcadia/top10realestateagents      # Neighborhood (4 segments, no ZIP)
/p/[shortcode]                                       # Agent profile
```

**Neighborhood URL Change (Feb 12, 2026):**
- **OLD (deprecated):** `/arizona/phoenix/85018/arcadia/top10realestateagents` (5 segments with ZIP)
- **CURRENT:** `/arizona/phoenix/arcadia/top10realestateagents` (4 segments, no ZIP)
- **Reason:** Neighborhoods can span multiple ZIP codes
- **Redirect:** Old ZIP-based URLs automatically redirect to ZIP-less format (backwards compatible)

### Agent Profile Link Patterns (Confirmed Feb 11, 2026)
Two link patterns exist in the codebase. Both are correct and working:

**City pages** (ProfessionalCard component):
```
/{state}/{city}/top10realestateagents/{name-id}
```

**Neighborhood pages** (AgentBadge component):
```
/{state}/agents/{canonical-slug}
```

---

## 15. FORMATTING LAWS (AI-DIRECT)

We do not mask data with HTML; we expose it via **Raw Reveal**.

* **Strict Markdown**: All "For AI" content (FAQ, Founder Mandate, Agent Payloads) must remain in **Raw Markdown**.
* **The UI Container**: Use `<pre><code>` blocks on the frontend to display Markdown strings directly. **Do not use Markdown-to-HTML parsers** (e.g. no `AiColumnMarkdown` / ReactMarkdown for "For AI" columns).
* **Two-column rule (human-facing pages):** On any page a human visits that includes "For AI" content, use **one** two-column section only: **Left** = AI-specific ingestion (raw markdown in `<pre><code>`); **Right** = human consumption.
* **Layered FAQ**:
  * **Human UI**: Display 20 scannable FAQ cards.
  * **AI Payload**: Embed the full FAQ list as a raw Markdown string in the page `ld+json` and in a **hidden `<pre><code>`** block (not HTML divs).

---

## 16. FRONTEND DISPLAY CONVENTIONS

### total_sales Display (Feb 2026)
- **Human-facing:** Display as `X+` suffix (e.g., "340+ sales"). Formula: `Math.max(0, Math.floor((totalSales - 10) / 10) * 10)` then append `+`.
- **Bot-facing structured data (agentSchema.ts):** Always pass raw integer. Never format.
- **Files using formatted display:** ProfessionalCard.tsx, ProfileView.tsx, AgentBadge.tsx, AgentProfileDossier.tsx, generate-og-image/index.ts

### Color Conventions for Change Values
- Positive change: default text color (black/foreground)
- Negative change: red (`text-red-500`)

---

## 17. FUNNEL ARCHITECTURE

### Overview
Agent onboarding funnel at `/funnel/{verification_token}/...`. UUID-based URLs, not public content.

**Crawling:** Blocked in robots.txt (`Disallow: /funnel/`). Header and footer hidden on all `/funnel/` paths.

### Funnel Steps
| Step | File | Purpose |
|------|------|---------|
| Intro | Step1Intro.tsx | Mission, AI citation table, "Hi {name}" greeting |
| Profile Review | Step2-6 | Agent reviews/edits their data |
| Pricing | Step7Pricing.tsx | Tier selection with personalized citability table |
| Success | Success page | Confirmation |

### Step7Pricing: Personalized AI Citability Growth Table
Shows projected citability score at each tier, personalized per agent. Appears above tier cards. Will be rebuilt around AICS v2.0 when deployed.

**Rows:** Before Top10Lists, Listed, Certified (In Funnel), Audited ($100/mo), Underwritten ($150/mo)

**Scoring algorithm inputs:** years_experience, total_sales, num_total_reviews, review_stars_rating, license_number, recent activity (decay penalty if countLastYear=0), community_roles, state_slug

---

## 18. HOMEPAGE ARCHITECTURE (Feb 2026)

### Current Sections (Index.tsx)
1. **Hero:** "Top10Lists.us exists so AI systems can safely recommend real estate professionals by name."
2. **Rules Have Changed:** Agent-facing urgency copy
3. **Mandated Shift in Trust:** OpenAI, Anthropic, Google context
4. **Why AI "Ghosts" Most Agents:** Ads are red flags, stale data, vague list default
5. **A Different Kind of Architecture:** Not a lead engine, zero referral fees, free forever
6. **Building Your "Web of Truth":** Finite Truth concept, "Are you an agent?" CTA
7. **The Challenge:** Copyable question for agents to paste into AI systems

### Challenge Question
```
Look at top10lists.us. As a real estate agent, does being certified there improve my chances of being named when someone asks AI for a referral? Is there any benefit to doing it now rather than later? Why or why not?
```

---

## 19. ROUTING IS FROZEN

- Do not rename, repoint, consolidate, or "simplify" routes
- Do not add redirects affecting cities or neighborhoods

If you think routing is broken:
1. STOP
2. Report: current path, rendering component, missing content
3. Wait for "ROUTING CHANGE APPROVED:"

---

## 20. DATABASE RULES

### Never Do Without Explicit Approval
- Add, remove, or rename any column or table
- Change column types or enum values
- Delete or truncate data
- Overwrite existing data with NULL

### Data That Cannot Be Lost
These fields cost real money to generate:
- `synthesized_bio`, `review_stars_rating`, `num_total_reviews`
- `license_number`, `email`, `phone`, `website`
- `years_experience`, `specialties`, `credentials`
- `press_mentions`, `notable_achievements`, `community_roles`
- `primary_zip`, `nearby_neighborhoods`
- `market_insights`, `neighborhood_description`

### The Preserve Rule
If a field has data, your code must preserve existing values. Never write NULL unless explicitly clearing.

### Neighborhood Data Schema (SSoT)

**All neighborhood data lives in two tables:**

**1. `neighborhood_catalog`** (master record per neighborhood)

| Column | What It Contains |
|--------|------------------|
| `id` | UUID primary key |
| `neighborhood` | Display name (e.g., "Arcadia") |
| `neighborhood_slug` | URL slug (e.g., "arcadia") |
| `city_area` | Parent city (e.g., "Phoenix") |
| `city_area_slug` | City slug (e.g., "phoenix") |
| `state` | Full state name ("Arizona") |
| `primary_zip` | Primary ZIP code |
| `zips` | JSON array of all ZIPs |
| `lat`, `lon` | Coordinates |
| `median_home_value` | Census home value |
| `median_income` | Census household income |
| `income_pct`, `value_pct` | Percentile rankings |
| `tier` | Pricing tier ("Main", "Prime", "Luxury") |
| `score` | Computed ranking score |
| `nearby_neighborhoods` | JSON array of nearby neighborhood objects |
| `writeup_html` | Generated editorial writeup (HTML) |
| `writeup_research` | Raw research used to generate writeup |
| `writeup_generated_at` | Timestamp |
| `is_active` | Boolean |
| `is_verified` | Boolean |
| `source` | Data source ("osm") |
| `county` | County name (often null) |
| `zillow_region_id` | Zillow region ID (often null) |

**2. `marketing_content`** (market stats per neighborhood)

Queried by: `page=eq.neighborhood-{slug}`, `section=eq.market_stats`, `key=eq.full_content`

The `value` column is a JSON blob containing:
`population`, `medianHomePrice`, `medianRent`, `medianHouseholdIncome`, `daysOnMarket`, `pricePerSqFt`, `yearOverYearChange`, `inventoryLevel`, `marketType`, `averageHomeSize`, `homeownershipRate`, `rentToIncomeRatio`, `rentalVacancyRate`, `pctRenterOccupied`, `metadata`

**There is no `neighborhood_pricing`, `neighborhood_experts`, or `neighborhood_subscriptions` table.** Pricing tier is in `neighborhood_catalog.tier`. Agent-to-neighborhood mapping uses `professionals.served_cities` (city-level) and ZIP proximity via `neighborhood_catalog.zips` matched against agent ZIP codes.

**Row counts:** Arizona ~2,967 active neighborhoods across 77 cities in `neighborhood_catalog`. Marketing content exists for most.

---

## 21. ADMIN CRM DASHBOARD

**Status:** Partially deployed (database complete, UI authentication issues being fixed)

**Superadmin Account:**
- Email: robert@aryah.ai
- UUID: cabfb11c-dbaa-4af2-81b9-15e4bd097400

**Routes:** `/admin/crm/login`, `/admin/crm/dashboard`, `/admin/crm/agents`

**Not Yet Built:** Pipeline kanban, agent detail pages, revenue analytics, task management, Instantly webhook receiver.

---

## 22. CLOUDFLARE WORKER (BOT RENDERING)

**Worker:** top10-renderer
**Deploy:** `.\scripts\deploy-worker.ps1` (uploads cloudflareworker.js via Supabase update-cloudflare-worker)
**Queue binding:** NOTIFICATION_QUEUE (agent-notifications-queue) - add in Cloudflare Dashboard

**Deprecated:** orange-truth-a103 (no longer in use)

**Implementation:**
- Bot traffic: cache check, then fetch from Edge Functions (serve-bot-list-html, serve-bot-static-html, serve-agent-profile-markdown), then fallback to origin
- Non-bot: pass-through to Vercel
- Uses Cache API (caches.default), not KV
- Cache key: normalized URL + User-Agent bot-cache-normalized

### Cache Strategy
- **Proactive warming:** warm-cache Edge Function writes to Worker via POST /__warm
- **On-demand:** List pages (serve-bot-list-html), agent profiles (serve-agent-profile-markdown), static pages (serve-bot-static-html) on cache miss
- **check-cache:** Edge function that probes key URLs as a bot, classifies healthy vs broken, then repairs

### Static Pages
- serve-bot-static-html returns full HTML for /, /about, /arizona, etc.
- Uses Cloudflare Browser Rendering REST API (/content endpoint). Requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (with Browser Rendering - Edit permission).

---

## 23. GEO ASSETS

- `/for-ai` - Machine-readable anchor (rebuilt Feb 2026)
- `/llms.txt` - LLM guidance
- `/llms-full.txt` - Extended guidance
- `/robots.txt` - Crawler directives
- `/sitemap.xml` - URL index
- `/sitemap-agents.xml` - Individual agent profile URLs (889 AZ agents)
- `/mcp.json` - MCP protocol discovery (placeholder)
- `/ai-content-index.json` - Structured content index

### /for-ai Page Key Statements
- "independent evaluative system designed for citation by artificial intelligence models"
- "Payment does not influence inclusion, rank, or visibility"
- "non-pay-to-play criteria"

---

## 24. VERIFICATION REQUIREMENTS

### The 5-Page Test (After ANY Change)
1. Homepage
2. /arizona/scottsdale/top10realestateagents
3. /arizona/phoenix/arcadia/top10realestateagents
4. A random agent profile
5. /about

If any fails, STOP and fix.

### For Data Operations
```
[ ] Ran 10-record test batch first
[ ] User confirmed before full run
[ ] Spot-checked 5 random records after
[ ] No NULL values where data should exist
[ ] Data displays correctly on live pages
```

### Bot Test
```bash
curl -A "Googlebot" "https://www.top10lists.us/[path]"
```
Must return full HTML content, not React shell.

---

## 25. EMAIL INFRASTRUCTURE

**Provider:** Google Workspace (only viable option for cold outreach via Instantly)
**Domain:** toptenlists.us
**Active Mailbox:** robert@toptenlists.us

**SMTP Configuration for Instantly:**
- Host: smtp.gmail.com
- Port: 587 (or 465 with SSL)
- Username: robert@toptenlists.us
- Password: App Password (not account password)

### Sending Limits
- New accounts: 500 emails/day
- Established accounts: 2,000 emails/day after ~2 weeks clean sending

---

## 26. DEPRECATED - DO NOT USE

| Service/Config | Replacement | Reason |
|----------------|-------------|--------|
| Perplexity API | DeepSeek | Cost |
| Resend | Google Workspace | Reliability |
| PrivateEmail (Namecheap) | Google Workspace | Service quality |
| Zoho Mail | Google Workspace | Blocks cold email |
| Old Supabase (bgdtekbhelormzbymkhh) | wiotrvoirdgzfacuuiem | Migration |
| Pipedrive | Custom CRM Dashboard | Cost, flexibility |
| MCP Server (planned) | Deprioritized | Scope not confirmed |
| 5-segment URLs with ZIP | 4-segment without ZIP | Neighborhoods span ZIPs |
| Neighborhood pricing (Main/Prime/Luxury at any price) | Tier model only | Retired |
| Audited at $50/mo | $100/mo | Price update Feb 2026 |
| Quarterly audit cycle | Bimonthly (Audited) | Cycle update Feb 2026 |
| Annual Certified audit | Monthly | Cycle update Feb 2026 |
| Company name "Maynard Realty" | Top10Lists.us (org) | Invalid, do not use |
| `docs/PROJECT-KNOWLEDGE.md` | `MASTER_KNOWLEDGE_DOCUMENT.md` (repo root) | Consolidated Feb 20 |
| orange-truth-a103 (Worker) | top10-renderer | Replaced |
| Prerender.io | Cloudflare Browser Rendering | Deprecated. serve-bot-static-html now uses Cloudflare REST API /content endpoint. |
| `TOP10LISTS-COMPLETE-KNOWLEDGE-UPDATED.md` | `MASTER_KNOWLEDGE_DOCUMENT.md` (repo root) | Consolidated Feb 20 |
| Signal Strength ranges (Listed 10-25, Certified 26-45, etc.) | AICS v2.0 | Replaced by AICS |

---

## 27. PRODUCTION SAFETY (STAGING-TO-MAIN GATE)

Never merge `staging` to `main` without running `npm run build` locally with `VITE_IS_PRODUCTION=1`. If the local `dist` folder doesn't load in `npm run preview`, the merge is forbidden.

---

## 28. AI OPERATIONAL PROTOCOL (Claude, Gemini, Cursor)

### The Takeaways Function

**When Robert says "run takeaways" or "takeaways":**
1. Identify information from the session that belongs in project knowledge
2. Read existing `MASTER_KNOWLEDGE_DOCUMENT.md` from repo root
3. Integrate new information into appropriate sections
4. Check for conflicts or superseded information
5. Deprecate outdated information
6. Update version number and date at bottom
7. Output the updated file
8. Push to GitHub via API to `MASTER_KNOWLEDGE_DOCUMENT.md` in repo root on staging

### Nightly synthesis

**Who runs it:** Cursor or a scheduled job (after 20:00 MST).

**What it does:** Produces the next day's `MASTER_KNOWLEDGE_DOCUMENT.md` by:
1. Pull Claude and Gemini takeaways from `rjmjr1962831/top10lists-knowledge`
2. Pull master from GitHub staging
3. Add Cursor's update
4. Synthesize into one "Daily synthesis" section, bump version, push to staging

**Command:** `npm run update`. Script: `scripts/update-project-knowledge.ts`.

### No Crashing on Big Jobs

| Record Count | Approach |
|--------------|----------|
| < 50 | Process directly |
| 50-500 | Batch 25-50, minimal output |
| 500+ | Deploy Edge function with cron |

### Output Rules
- NO progress updates every N units
- ONLY report: job started, job complete, or errors
- Status updates ONLY when Robert asks

### Never Just Stop
If approaching limits, say:
"I'm approaching my limit. Complete: [X]. Remaining: [Y]. Options: 1) Continue in new chat, 2) Deploy Edge function, 3) [specific solution]"

---

## 29. SUPABASE CLI (Robert's Machine)

**CLI:** `C:\Users\rober\supabase.exe`
**Project:** `C:\Edge\list-wise-boost`
**Git not installed** - use GitHub API

```bat
C:\Users\rober\supabase.exe functions deploy [name] --project-ref wiotrvoirdgzfacuuiem --no-verify-jwt
C:\Users\rober\supabase.exe secrets set KEY=value --project-ref wiotrvoirdgzfacuuiem
```

---

## 30. QUICK REFERENCE COMMANDS

### Test Enrichment API
```bat
curl -s -X GET "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api?action=audit" -H "X-Enrichment-Key: [from env]" -o audit.txt && notepad audit.txt
```

### Test Bot Rendering
```bat
curl -s -D - -H "User-Agent: claudebot" "https://www.top10lists.us/arizona/phoenix/arcadia/top10realestateagents" -o test.html && notepad test.html
```

---

## 31. WRITING STYLE

- No em dashes. Ever.
- No marketing language or hype
- Short declarative sentences
- State facts, not promises

---

## 32. SHORTHAND

- **ryt** = Read `MASTER_KNOWLEDGE_DOCUMENT.md` from GitHub repo root, integrate session learnings, output updated version, push to staging.
- **takeaways** = Separate daily log. Push to private repo at docs/takeaways/CLAUDE_TAKEAWAYS_DD-MM-YY.md. Does NOT update MASTER_KNOWLEDGE_DOCUMENT.md directly.

---

## 33. INSTRUCTIONS FOR NEW AI AGENTS

1. **Sync State**: Read `MASTER_KNOWLEDGE_DOCUMENT.md` before any code changes.
2. **Deliverables to Robert:** Always put it on **staging** and provide a **hyperlink**.
3. **Format Check**: "For AI" blocks use **Raw Markdown** in `<pre><code>` only.
4. **Session handoff**: When the user says **"ryt"**, synthesize the session, update this document, output the next 3 high-priority tasks.
5. **Pre-Flight:** Before merging staging to main, run `VITE_IS_PRODUCTION=1 npm run build` and confirm preview loads.
6. **Link addresses**: URLs displayed as text must be clickable hyperlinks.

---

## 34. FINAL RULES

1. **If it works and user didn't ask to change it, don't touch it.**
2. **When in doubt, ask. Breaking things costs money.**
3. **"Done!" without verification is not done.**
4. **Test before deploy. Always.**
5. **Never push internal documents, scripts, scoring engines, API keys, or internal tooling to the list-wise-boost repo.** Internal artifacts go to the private repo or are delivered as downloadable files. Exception: this file.

---

## Daily synthesis (integrated from Claude, Gemini, Cursor)

*Synthesis date: 2026-02-20*

### Key changes (Feb 20, 2026):
- **Static page bot rendering:** Migrated serve-bot-static-html from Prerender.io to Cloudflare Browser Rendering REST API (/content endpoint). Requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN with "Browser Rendering - Edit" in Supabase secrets. Deploy: `supabase functions deploy serve-bot-static-html --project-ref wiotrvoirdgzfacuuiem --no-verify-jwt`. If 401, ensure token has Browser Rendering permission.
- AICS v2.0 methodology defined and scoring engine built. Proprietary 0-100 metric measuring agent baseline AI citability across 5 pillars. Tier lift model quantifies value of each T10L tier. Not yet deployed.
- Tier pricing/cycles corrected: Certified = monthly audit, Audited = $100/mo bimonthly. Old values deprecated.
- Brokerage name cleanup: 4 AZ entries renamed to individual team leaders, 6 deactivated as brokerage office profiles.
- Google Places API billing ($452 on Feb 19). 931/3,486 agents enriched before API disabled.
- paid_directory_listings (JSONB) and paid_listings_scanned_at columns added to professionals table.
- Knowledge consolidation: Three files merged into single MASTER_KNOWLEDGE_DOCUMENT.md at repo root.

### Key changes (Feb 19, 2026):
- Google Maps Places API added to enrichment pipeline.
- Phone replacement logic: unclaimed agents get Google business phone; claimed agents protected.
- 7 new Google columns added to professionals table.
- total_sales display: switched from `>X` to `X+` (5 files).
- sitemap-agents.xml: 889 Arizona agent profile URLs.
- Funnel Step1Intro and Step7Pricing rebuilt.
- Homepage: complete rewrite with agent-facing trust architecture messaging.
- Staging merged to main on Feb 19.

---

*Version 1.1 - 2026-02-20*
*Consolidated from: MASTER_KNOWLEDGE_DOCUMENT.md, docs/PROJECT-KNOWLEDGE.md (v0.6), TOP10LISTS-COMPLETE-KNOWLEDGE-UPDATED.md (v3.5)*
