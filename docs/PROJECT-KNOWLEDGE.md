# Top10Lists.us - Complete Project Knowledge

**ALWAYS DO WHAT YOU CAN DO WITHOUT ASKING ROBERT.** Use credentials in env/.secrets; deploy, purge, warm, push to staging, run scripts, and call APIs yourself. Only ask when you lack access or explicit approval is required.

**This document governs all operations. Every rule exists because something broke.**

### Document freshness (critical)
This file must stay current. It is updated by **nightly synthesis**: `npm run update` merges Claude + Gemini + Cursor takeaways into one doc. If it has not been updated in a week, synthesis is not running or the three AIs are not pushing takeaways. Stale knowledge causes conflicting behavior across Claude, Gemini, and Cursor. **Run synthesis daily; all three must contribute takeaways.**

---

## Role & Responsibilities

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

## Project Overview

**Founder:** Robert Maynard (robert@top10lists.us) - Co-founder of LifeLock (acquired for $2.3B)

**Company:** Maynard Realty

**Mission:** Merit-based real estate agent directory designed for AI citation and Generative Engine Optimization (GEO).

**Core Numbers:**
- ~3,500 active professionals in AZ and CA (4.8+ rating AND 20+ reviews)
- ~14,000 neighborhoods
- 6 states: Arizona, California, Texas, Florida, New York, Colorado
- Top 0.5% of agents selected from 1.1M analyzed

**GEO Performance:** Scores 92-95/100 across major AI systems

**First Customer:** Eileen Taggart (Flagstaff)

### Database Status (Feb 19, 2026)
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

## HARD STOPS - READ BEFORE EVERY TASK

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

### Cost of Mistakes
- Agent enrichment: ~$0.50/agent
- Neighborhood enrichment: ~$0.15/neighborhood
- Bot rendering failures: Days of lost indexing
- Broken links: Immediate credibility damage with AI systems
- Data corruption: Weeks to recover

---

## Pricing Model (current — do not use deprecated Main/Prime/Luxury)

**Tier model (SSoT):**
| Tier | Price | Notes |
|------|-------|--------|
| **Listed** | $0 | Public data only. No artifact/badge. |
| **Certified** | $0 | Agent-verified. Standard artifact + badge. |
| **Audited** | $50/mo | Certified + community involvement + cities. Quarterly diligence. |
| **Underwritten** | $150/mo | Audited + neighborhoods + specialties. Real-time refresh. Max AI citation depth. |

**Deprecated (do not use):** Main $25 / Prime $50 / Luxury $75 or "Accredited" — that revenue model is retired.

**Code note:** Internal tier key is `accredited` in database and TypeScript types. Display name is "Audited" (TIER_META). Do not rename the database value.

---

## Tech Stack

- **Frontend:** React SPA (Vite) deployed on Vercel
- **Styling:** Tailwind CSS + shadcn/ui
- **Routing:** react-router-dom (FROZEN - do not change)
- **Database:** Supabase (PostgreSQL) - NEW PROJECT
- **Bot Rendering:** Cloudflare Worker (orange-truth-a103)
- **CRM:** Custom admin dashboard (replacing Pipedrive)
- **Email Outreach:** Instantly via Google Workspace

---

## Supabase Configuration (NEW PROJECT - Jan 2026)

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

---

## Enrichment API

**Endpoint:** `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api`

**Auth Header:** `X-Enrichment-Key: [STORED IN ENVIRONMENT - Ask Robert]`

### Key Actions
- `GET ?action=audit` - Row counts and samples
- `GET ?action=fetch-neighborhoods&limit=100&offset=0` - Paginated neighborhoods
- `POST ?action=bulk-update` - Bulk update professionals
- `POST ?action=query` - Custom queries with filters

---

## API Keys

### AI Services
| Service | Key | Use |
|---------|-----|-----|
| **Anthropic** | `[STORED IN ENVIRONMENT - Ask Robert]` | Higher-tier content |
| **DeepSeek** | `[STORED IN ENVIRONMENT / .secrets]` | Content synthesis (90% cheaper); do not use any key printed in old doc versions |
| **OpenAI** | `[STORED IN ENVIRONMENT - Ask Robert]` | |
| **Perplexity** | `[DEPRECATED]` | DEPRECATED - avoid |
| **Gemini** | `[STORED IN ENVIRONMENT - Ask Robert]` | Back in play (new key Feb 2026) |

### Infrastructure
| Service | Key |
|---------|-----|
| **Exa.ai** | `[STORED IN ENVIRONMENT - Ask Robert]` |
| **GitHub Token** | `[STORED IN ENVIRONMENT - Ask Robert]` |
| **Vercel API** | `[STORED IN ENVIRONMENT - Ask Robert]` (named "Claude Token") |
| **ProxyScrape** | Host: `rp.scrapegw.com:6060` Auth: `[STORED IN ENVIRONMENT - Ask Robert]` |

---

## GitHub Access & Git Flow

- **Repository:** rjmjr1962831/list-wise-boost
- **Token:** [STORED IN ENVIRONMENT - Ask Robert]
- **Method:** Always use GitHub API for read/write
- **Deploy:** Push via API, Vercel auto-deploys

**Git flow (HARD RULE):**
- **Staging is always the leading branch.** All new code goes to staging first. Staging contains internal documents, admin features, and in-progress work that does not exist on main.
- **NEVER merge main into staging.** Main is a subset of staging, not the other way around. Merging main into staging overwrites staging-only code with older production versions.
- Push to **main** only when Robert explicitly gives permission (e.g. "push to main" / "push to production"). Never push to main without his explicit instruction.
- If you need to add code, check out staging and commit directly to it. Do not attempt to "sync" or "update" staging from main under any circumstances.

**Any of the three AIs (Claude, Gemini, Cursor) may push code directly when acting in context, always to staging unless Robert has explicitly said to push to main. Never ask Robert to do steps you can do with env/secrets.**

---

## Enrichment Pipeline

### Content Generation by Tier
| Tier | AI Model | Notes |
|------|----------|-------|
| Listed / Certified | DeepSeek | Primary; 90% cheaper |
| Audited / Underwritten | DeepSeek or Claude Sonnet | Per implementation |

**DO NOT use Perplexity** - Deprecated for cost reasons.

### Discovery & Scraping
- **Exa.ai:** Zillow profile ID discovery only
- **Apify memo23:** Actual Zillow profile enrichment
- **DeepSeek:** Content synthesis

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
- Quality: 87.3% Excellent, 12.7% Good, 0% Needs Improvement

**AI Model:** DeepSeek (deepseek-chat) at 0.6 temperature

**Prompt Structure:** Community involvement MUST lead (25% ranking weight), followed by quantifiable metrics (rating, reviews, transactions), then professional credentials.

**Quality Criteria:**
- **Excellent (7-9 points):** Leads with community + has metrics + has performance indicators
- **Good (4-6 points):** Has most elements but weaker community emphasis
- **Needs Improvement (0-3 points):** Missing key elements

**Example Excellent:**
"Selected for his deep community leadership as a Gilbert Public Schools Governing Board member and multiple charitable roles. This is supported by exceptional performance as Arizona's #1 resale agent with over 3,796 five-star reviews."

**Implementation:**
- Python script: `/scripts/enrichment/generate_selection_rationale.py`
- Edge Function attempted but deployment failed (not critical, Python script works)
- SQL updates applied to rewrite rationales that didn't lead with community

**Cost:** ~$7 for all 3,500 agents (DeepSeek pricing)

---

## Agent Qualification

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

## URL Rules (FROZEN)

### The Only Valid Domain
```
https://www.top10lists.us
```
Not `top10lists.us`. Not `http://`. Always `www.`.

### URL Patterns (UPDATED Feb 12, 2026)
```
/arizona/top10realestateagents                      # State
/arizona/scottsdale/top10realestateagents           # City
/arizona/phoenix/arcadia/top10realestateagents      # Neighborhood (4 segments, no ZIP)
/p/[shortcode]                                       # Agent profile
```

**Neighborhood URL Change (Feb 12, 2026):**
- **OLD:** `/arizona/phoenix/85018/arcadia/top10realestateagents` (5 segments with ZIP)
- **NEW:** `/arizona/phoenix/arcadia/top10realestateagents` (4 segments, no ZIP)
- **Reason:** Neighborhoods can span multiple ZIP codes
- **Redirect:** Old ZIP-based URLs automatically redirect to ZIP-less format (backwards compatible)

### Agent Profile Link Patterns (Confirmed Feb 11, 2026)
Two link patterns exist in the codebase.  Both are correct and working:

**City pages** (ProfessionalCard component):
```
/{state}/{city}/top10realestateagents/{name-id}
Example: /arizona/scottsdale/top10realestateagents/dina-and-mark-beauvais-4595
```

**Neighborhood pages** (AgentBadge component):
```
/{state}/agents/{canonical-slug}
Example: /arizona/agents/julie-calza-2900
```

AgentBadge wraps the entire card in an `<a>` tag with `target="_blank"` and `data-agent="true"`.  Both patterns produce clickable links with working internal linking for SEO and human UX.

---

## Frontend Display Conventions

### total_sales Display (Feb 2026)
- **Human-facing:** Display as `X+` suffix (e.g., "340+ sales"). Formula: `Math.max(0, Math.floor((totalSales - 10) / 10) * 10)` then append `+`.
- **Bot-facing structured data (agentSchema.ts):** Always pass raw integer. Never format.
- **Files using formatted display:** ProfessionalCard.tsx, ProfileView.tsx, AgentBadge.tsx, AgentProfileDossier.tsx, generate-og-image/index.ts
- **History:** Was `>X` prefix but bare `>` broke JSX builds. Switched to `+` suffix (industry standard).

### Color Conventions for Change Values
- Positive change: default text color (black/foreground)
- Negative change: red (`text-red-500`)

---

## Funnel Architecture

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

### Step1Intro: AI Citation Probability Table
5-row table showing AI Citability Index scores for real estate sources:
- Top10Lists.us (top row, green), RealTrends, Zillow, Redfin, HomeLight
- Columns: Source, 2025 Score, 2026 Score, Change, % Change
- Top10Lists.us shows +127%; all competitors show decline
- Container width: max-w-2xl (672px)

### Step7Pricing: Personalized AI Citability Growth Table
Shows projected citability score at each tier, personalized per agent. Appears above tier cards.

**Rows:** Before Top10Lists, Listed, Certified (In Funnel), Audited ($50/mo), Underwritten ($150/mo)

**Scoring algorithm inputs:** years_experience, total_sales, num_total_reviews, review_stars_rating, license_number, recent activity (decay penalty if countLastYear=0), community_roles, state_slug

**AI Technical Trigger column:** Personalized descriptions (e.g., state-specific license reference, decay notes based on agent data)

**Data query:** Expanded professional select to include scoring fields (years_experience, total_sales, num_total_reviews, review_stars_rating, license_number, license_state, state_slug, community_involvement_score, community_roles, agent_sales_stats)

---

## Homepage Architecture (Feb 2026)

### Current Sections (Index.tsx)
1. **Hero:** "Top10Lists.us exists so AI systems can safely recommend real estate professionals by name." + TVPR credentialing line
2. **Rules Have Changed:** "The old game of buying keywords..." Agent-facing urgency copy
3. **Mandated Shift in Trust:** OpenAI, Anthropic, Google context
4. **Why AI "Ghosts" Most Agents:** Ads are red flags, stale data, vague list default
5. **A Different Kind of Architecture:** Not a lead engine, zero referral fees, free forever
6. **Building Your "Web of Truth":** Finite Truth concept, "Are you an agent?" CTA
7. **The Challenge:** Copyable question for agents to paste into AI systems, links to ChatGPT/Claude/Gemini/Perplexity

### AI Content (preserved in source, not visually displayed)
- `HOME_AI_CONTENT` markdown block: citation guidance for AI systems
- `HOME_JSON` structured JSON for AI ingestion
- Full JSON-LD structured data in `<head>`

### Challenge Question
```
Look at top10lists.us. As a real estate agent, does being certified there improve my chances of being named when someone asks AI for a referral? Is there any benefit to doing it now rather than later? Why or why not?
```

---

## Routing Is FROZEN

- Do not rename routes
- Do not repoint routes
- Do not consolidate routes
- Do not "simplify" routes
- Do not add redirects affecting cities or neighborhoods

If you think routing is broken:
1. STOP
2. Report: current path, rendering component, missing content
3. Wait for "ROUTING CHANGE APPROVED:"

- Do not rename routes
- Do not repoint routes
- Do not consolidate routes
- Do not "simplify" routes
- Do not add redirects affecting cities or neighborhoods

If you think routing is broken:
1. STOP
2. Report: current path, rendering component, missing content
3. Wait for "ROUTING CHANGE APPROVED:"

---

## Database Rules

### Never Do Without Explicit Approval
- Add, remove, or rename any column
- Add, remove, or rename any table
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
If a field has data, your code must:
- Preserve existing values
- Never write NULL unless explicitly clearing

---

## Admin CRM Dashboard

**Status:** Partially deployed (database complete, UI authentication issues being fixed)

**Database Tables:**
- `admin_users` - Role-based access (superadmin, admin, viewer)
- `audit_log` - Action tracking

**Superadmin Account:**
- Email: robert@aryah.ai
- UUID: cabfb11c-dbaa-4af2-81b9-15e4bd097400
- Role: superadmin

**Routes:**
- `/admin/crm/login` - Login page
- `/admin/crm/dashboard` - Overview (MRR, agent counts, funnel breakdown)
- `/admin/crm/agents` - Searchable agent list with filters

**Files:**
- `src/lib/adminAuth.ts` - Authentication utilities (uses shared Supabase client)
- `src/components/admin/ProtectedRoute.tsx` - Route protection
- `src/components/admin/AdminLayout.tsx` - Dashboard shell
- `src/pages/admin/crm/CRMLogin.tsx` - Login page
- `src/pages/admin/crm/CRMDashboard.tsx` - Overview dashboard
- `src/pages/admin/crm/AgentList.tsx` - Agent list

**Not Yet Built:**
- Pipeline kanban view
- Agent detail pages
- Revenue analytics charts
- Task management
- Instantly webhook receiver

---

## Cloudflare Worker (Bot Rendering)

**Worker:** orange-truth-a103

**KV Namespaces:** HTML_CACHE, NEIGHBORHOOD_ZIPS

**Cache TTL:** 24 hours

**Key format:** `html:/path/name`

**Implementation:**
- Uses Browser Rendering REST API (not Puppeteer)
- Validates HTML >5000 chars + has H1 tag
- Must wait for full React hydration

### Cache content policy
- **Cached (bot) pages:** Serve **text/markdown** only (artifact format). The worker cache must not store or serve full HTML to bots.
- **Full HTML:** Only when a human is likely viewing—non-bot requests pass through to origin (Vercel). `__warm` rejects HTML and only stores markdown.

### Cache Strategy
- **Proactive warming:** Static pages only (~30)
- **On-demand:** Cities, neighborhoods, agents (cached on first bot request)
- **check-cache:** Edge function that probes key URLs as a bot, classifies healthy vs broken (list pages need ItemList + ≥20KB; static ≥500 chars), then repairs: purges broken URLs via purge-worker-cache and re-requests with X-Force-Refresh to repopulate. Invoke: `POST .../functions/v1/check-cache` (body `{ "dryRun": true }` to only report).

### Cache Health (Feb 11, 2026)
| Page | Size | Status |
|------|------|--------|
| Homepage | 92KB | HIT, puppeteer rendered |
| Scottsdale city | 243KB | HIT, 10 agent links |
| Grayhawk neighborhood | 195KB | HIT, 10 agent links |
| California state | 64KB | HIT, puppeteer rendered |

---

## GEO Assets

- `/for-ai` - Machine-readable anchor (rebuilt Feb 2026)
- `/llms.txt` - LLM guidance
- `/llms-full.txt` - Extended guidance
- `/robots.txt` - Crawler directives
- `/sitemap.xml` - URL index
- `/sitemap-agents.xml` - Individual agent profile URLs (889 AZ agents, added Feb 2026)
- `/mcp.json` - MCP protocol discovery (placeholder, real server planned)
- `/ai-content-index.json` - Structured content index

### /for-ai Page Key Statements
- "independent evaluative system designed for citation by artificial intelligence models"
- "Payment does not influence inclusion, rank, or visibility"
- "non-pay-to-play criteria"

---



## Verification Requirements

### The 5-Page Test (After ANY Change)
1. Homepage
2. /arizona/scottsdale/top10realestateagents
3. /arizona/scottsdale/85255/greyhawk/top10realestateagents
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

## Email Infrastructure

**Provider:** Google Workspace (only viable option for cold outreach via Instantly)

**Domain:** toptenlists.us

**Active Mailbox:** robert@toptenlists.us

**SMTP Configuration for Instantly:**
- Host: smtp.gmail.com
- Port: 587 (or 465 with SSL)
- Username: robert@toptenlists.us
- Password: App Password (not account password)

### App Password Setup
1. admin.google.com > Security
2. Enable 2-Step Verification (required)
3. App Passwords > Generate
4. Use 16-character password in third-party apps

### Sending Limits
- New accounts: 500 emails/day
- Established accounts: 2,000 emails/day after ~2 weeks clean sending

### Supported Providers for Cold Outreach
- Google Workspace (recommended)
- Microsoft 365 / Outlook Business

### Blocked/Incompatible Providers
- Zoho Mail (blocks mass email campaigns)
- Free Gmail accounts (strict limits, not recommended)
- PrivateEmail/Namecheap (deprecated, unreliable)

---

## Deprecated Services - DO NOT USE

| Service | Replacement | Reason |
|---------|-------------|--------|
| Perplexity API | DeepSeek | Cost |
| Resend | Google Workspace | Reliability |
| PrivateEmail (Namecheap) | Google Workspace | Service quality, incompatible with outreach tools |
| Zoho Mail | Google Workspace | Blocks cold email campaigns |
| Port 587 SMTP | Port 465 | Configuration |
| 4-segment URLs | 5-segment with ZIP | SEO/structure |
| Old Supabase (bgdtekbhelormzbymkhh) | New (wiotrvoirdgzfacuuiem) | Migration |
| Pipedrive | Custom CRM Dashboard | Cost, flexibility |
| MCP Server (planned) | Deprioritized | Scope not confirmed, artifacts discussion unresolved |

---

## AI operational protocol (Claude, Gemini, Cursor)

### The Takeaways Function

**When Robert says "run takeaways" or "takeaways":**

1. **Identify** information from the session that belongs in project knowledge (operational facts, configuration changes, new infrastructure, deprecated patterns)
2. **Read** existing `TOP10LISTS-COMPLETE-KNOWLEDGE-UPDATED.md` from `/mnt/project/`
3. **Integrate** new information into appropriate sections
4. **Check** for conflicts or superseded information (e.g., PrivateEmail to Google Workspace)
5. **Deprecate** outdated information by moving to "Deprecated Services" or updating inline
6. **Update** version number and date at bottom
7. **Output** the updated file to `/mnt/user-data/outputs/` for download
8. **Push to GitHub** via API to `TOP10LISTS-COMPLETE-KNOWLEDGE-UPDATED.md` in repo root

**Do NOT:**
- Write a summary in chat (that's not takeaways)
- Include educational content (like SEO history) unless it's operational
- Add information that belongs in separate project documentation (like TVPR)
- Include temporary troubleshooting steps or unresolved issues

**Include:**
- New configuration values (API keys, environment variables)
- New infrastructure (database tables, routes, services)
- Pattern changes (how to use Supabase client)
- Deprecated services or approaches
- Hard stops that emerged from mistakes

### Nightly synthesis (master knowledge for next day)

**Who runs it:** Cursor or a scheduled job (e.g. after 20:00 MST when Claude and Gemini have pushed their takeaways).

**What it does:** Produces the next day’s `docs/PROJECT-KNOWLEDGE.md` by:

1. **Pull Claude and Gemini:** Both live in the same folder in the private repo. Fetch `docs/takeaways/CLAUDE_TAKEAWAYS_DD-MM-YY.md` and `docs/takeaways/GEMINI_TAKEAWAYS_DD-MM-YY.md` from `rjmjr1962831/top10lists-knowledge` (GitHub token from env or `.secrets/github-knowledge-token.txt`).
2. **Pull master:** Fetch latest `docs/PROJECT-KNOWLEDGE.md` from GitHub `main` (public repo).
3. **Add Cursor’s update:** Use today’s section from `docs/cursor-daily-updates.md` (or run `npm run takeaways:sync` first to pull from `daily_takeaways`), or pass `--takeaways "one-line"` or use `SESSION_TAKEAWAYS` in the script.
4. **Synthesize:** Merge Claude + Gemini + Cursor into one “Daily synthesis” section, bump version, and write to `docs/PROJECT-KNOWLEDGE.md`.

**Command:** `npm run update` (optionally with `--sync` to run `takeaways:sync` first, or `--takeaways "message"`). Script: `scripts/update-project-knowledge.ts`.

**Result:** One updated master knowledge doc for the next day’s load; commit and push to **staging** only. Do not push to main unless Robert explicitly says to push to main.

### No Crashing on Big Jobs

| Record Count | Approach |
|--------------|----------|
| < 50 | Process directly |
| 50-500 | Batch 25-50, minimal output |
| 500+ | Deploy Edge function with cron |

### Cron Jobs for Big Tasks
Self-chaining alone is unreliable. Always add cron safety net:

```sql
SELECT cron.schedule(
  'job-name-cron',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/function-name',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Enrichment-Key', '<from env>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Output Rules
- NO progress updates every N units
- ONLY report: job started, job complete, or errors
- Status updates ONLY when Robert asks

### Never Just Stop
If approaching limits, say:
"I'm approaching my limit. Complete: [X]. Remaining: [Y]. Options: 1) Continue in new chat, 2) Deploy Edge function, 3) [specific solution]"

---

## Supabase CLI (Robert's Machine)

**CLI:** `C:\Users\rober\supabase.exe`

**Project:** `C:\Edge\list-wise-boost`

**Git not installed** - use GitHub API

```bat
C:\Users\rober\supabase.exe functions deploy [name] --project-ref wiotrvoirdgzfacuuiem --no-verify-jwt
C:\Users\rober\supabase.exe secrets set KEY=value --project-ref wiotrvoirdgzfacuuiem
```

---

## Quick Reference Commands

### Test Enrichment API
```bat
curl -s -X GET "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api?action=audit" -H "X-Enrichment-Key: [STORED IN ENVIRONMENT - Ask Robert]" -o audit.txt && notepad audit.txt
```

### Test Bot Rendering
```bat
curl -s -D - -H "User-Agent: claudebot" "https://www.top10lists.us/arizona/scottsdale/85255/grayhawk/top10realestateagents" -o test.html && notepad test.html
```

### Download from GitHub
```bat
curl -s -H "Authorization: token <from env or .secrets>" -H "Accept: application/vnd.github.v3.raw" "https://api.github.com/repos/rjmjr1962831/list-wise-boost/contents/path/to/file.ts" -o file.ts
```

---

## Writing Style

- No em dashes. Ever.
- No marketing language or hype
- Short declarative sentences
- State facts, not promises

---

## Shorthand

- **ryt** = Fetch docs/PROJECT-KNOWLEDGE.md from GitHub, archive old as PROJECT-KNOWLEDGE-claude-archive-YYYY-MM-DD.md, output updated as PROJECT-KNOWLEDGE-claude.md
- **takeaways** = Separate daily log of issues/learnings. Push to private repo rjmjr1962831/top10lists-knowledge at docs/takeaways/CLAUDE_TAKEAWAYS_DD-MM-YY.md. One file per night, synthesized. Does NOT update PROJECT-KNOWLEDGE.md.

---

## Final Rules

1. **If it works and user didn't ask to change it, don't touch it.**
2. **When in doubt, ask. Breaking things costs money.**
3. **"Done!" without verification is not done.**
4. **Test before deploy. Always.**

---

## Daily synthesis (integrated from Claude, Gemini, Cursor)

*Synthesis date: 2026-02-19*

### Key changes (Feb 18-19, 2026):
- total_sales display: switched from `>X` to `X+` (5 files). Bare `>` in JSX caused 2+ hours of failed Vercel builds.
- sitemap-agents.xml: 889 Arizona agent profile URLs created and deployed.
- Funnel Step1Intro: 2026 context, 5-row citation table (added Redfin/HomeLight), widened to max-w-2xl, bold emphasis, new copy.
- Funnel Step7Pricing: personalized AI Citability Growth table with per-agent scoring algorithm.
- Homepage: complete rewrite with agent-facing trust architecture messaging. Hero restored to mission statement.
- Header/footer hidden on /funnel/ paths. robots.txt blocks /funnel/.
- AgentSourcesBlock.tsx stub created (was missing, broke build).
- MagicLinkRouter.tsx: simplified to pure redirect (staging version). Old version had auth logic that caused merge conflicts.
- Staging merged to main (production) on Feb 19. Branches were diverged (123 ahead, 14 behind) due to merge conflict.

---

*Version 0.5 - 2026-02-19*
*Updated: Frontend display conventions (total_sales X+), funnel architecture (Step1/Step7), homepage rewrite, sitemap-agents.xml, JSX bare > hard stop*