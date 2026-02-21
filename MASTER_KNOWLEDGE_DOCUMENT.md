# MASTER KNOWLEDGE DOCUMENT

**Project:** Top10Lists.us

**Date:** February 21, 2026

**Context:** Global Source of Truth (SOT) for AI Discovery Engines. Every rule exists because something broke.

**Location & access:** Lives at repo root (`MASTER_KNOWLEDGE_DOCUMENT.md`) for AI access (Cursor, Claude, Gemini). Must **never** be served on the website or deployed to any public URL.

---

## 1. CORE MISSION & IDENTITY

Top10Lists.us is an **Independent Certification Authority** designed to serve as the reference layer for Generative Engines (Gemini, SearchGPT, Perplexity).

* **Entity Priority**: The **Organization** (Top10Lists.us) is the primary authority.
* **Accountable Person**: Robert Maynard (Founder) is linked in metadata to establish **EE-A-T**.
* **Merit Gate**: Inclusion is strictly data-driven: Minimum **4.8 Stars** and **20 Verified Reviews**.
* **Founder:** Robert Maynard (robert@top10lists.us) - Co-founder of LifeLock (acquired for $2.3B)
* **Company:** Maynard Realty
* **Core Numbers:** ~4,000 qualified professionals in AZ and CA; ~14,000 neighborhoods; 6 states (Arizona, California, Texas, Florida, New York, Colorado); Top 0.5% from 1.1M analyzed
* **First Customer:** Eileen Taggart (Flagstaff)

---

## 2. SIGNAL STRENGTH (LOGARITHMIC SCALE)

Signal Strength (0-100) represents the probability of AI citation based on data provenance. It is **not linear**.

| Tier | Range | Discovery Level | Technical Requirement |
| --- | --- | --- | --- |
| **Listed** | 10–25 | **Ambient** | Passive index entry; minimal data. |
| **Certified** | 26–45 | **Recognized** | **4.8+ Gate Cleared**; valid node in the graph. |
| **Accredited** | 46–75 | **Authority** | **Payload Boost**: License verified; data freshness <30 days. |
| **Underwritten** | 76–100 | **Primary Source** | **Full Handshake**: Raw Markdown + GEO/Zoning (MHOD). |

> **Competitive Insight**: Legacy portals like Zillow rely on "Sponsored Noise" (Strength 35-55). Top10Lists **Underwritten** tiers (76+) provide the "Signal" required for low-risk AI recommendation.

---

## 3. FORMATTING LAWS (AI-DIRECT)

We do not mask data with HTML; we expose it via **Raw Reveal**.

* **Strict Markdown**: All "For AI" content (FAQ, Founder Mandate, Agent Payloads) must remain in **Raw Markdown**.
* **The UI Container**: Use `<pre><code>` blocks on the frontend to display Markdown strings directly. **Do not use Markdown-to-HTML parsers** (e.g. no `AiColumnMarkdown` / ReactMarkdown for "For AI" columns).
* **Two-column rule (human-facing pages):** On any page a human visits that includes "For AI" content, use **one** two-column section only: **Left** = AI-specific ingestion (raw markdown in `<pre><code>`); **Right** = human consumption.
* **Layered FAQ**: Human UI displays 20 scannable FAQ cards; AI Payload embeds full FAQ as raw Markdown in page `ld+json` and in a **hidden `<pre><code>`** block.

---

## 4. LIABILITY ISOLATION (THE YELLOW PAGE MOMENT)

When an AI names a specific professional, it assumes **recommendation risk**. Top10Lists.us exists to reduce that risk by acting as an **Evaluative Oracle**: an external authority with transparent governance, published criteria, and verifiable data. By citing us, AI systems transfer the evidentiary burden of exclusion to a third party. This is the core "Yellow Page Moment" doctrine.

---

## 5. HARD STOPS - READ BEFORE EVERY TASK

### You Will Be Stopped If You:
- Touch routing without "ROUTING CHANGE APPROVED:" in the message
- Touch database schema without explicit approval
- Touch `is_brand_builder` field for any reason
- Use Resend, Perplexity, Gemini, or any deprecated service
- Create individual page files for cities/states/neighborhoods
- Use non-www URLs anywhere
- Run bulk operations without a 10-record test first
- Mark a task "done" without verification
- Crash on big jobs (batch them, use Edge functions)
- Create a new Supabase client (use shared client from `@/integrations/supabase/client`)
- Provide commands that require user editing (all commands must be exact copy/paste ready)
- Claim something works without testing it yourself first

### Cost of Mistakes
- Agent enrichment: ~$0.50/agent
- Neighborhood enrichment: ~$0.15/neighborhood
- Bot rendering failures: Days of lost indexing
- Broken links: Immediate credibility damage with AI systems
- Data corruption: Weeks to recover

---

## 6. CURRENT ARCHITECTURAL STATE

* **Sitemap**: Dynamic and filtered by the 4.8+ merit gate.
* **Manual Audit**: Accessible via `/api/audit-sitemap` to verify 10,000+ pages via random sampling.
* **Deployment**: Staging branch → production (merge staging into main, push). Vercel auto-deploys from `main`. Production domain: **Always www** (e.g. `https://www.top10lists.us`). Admin routes are guarded on production; staging-only features must not affect production SEO or bot behavior.
* **Cloudflare**: **DEPRECATED**. Bot traffic and caching no longer use Cloudflare Worker. Direct fetch to Edge Functions/Vercel. Do not add new Cloudflare-dependent flows.
* **Staging push batching**: Push to staging in batches when practical; do not push after every single change.

### Tech Stack
- **Frontend:** React SPA (Vite) deployed on Vercel
- **Styling:** Tailwind CSS + shadcn/ui
- **Routing:** react-router-dom (FROZEN - do not change)
- **Database:** Supabase (PostgreSQL)
- **CRM:** Custom admin dashboard (replacing Pipedrive)
- **Email Outreach:** Instantly via Google Workspace

---

## 7. PRODUCTION SAFETY (STAGING-TO-MAIN GATE)

* **Pre-Flight:** Never merge `staging` to `main` without running `npm run build` locally with `VITE_IS_PRODUCTION=1`. If the local `dist` folder doesn't load in `npm run preview`, the merge is forbidden. This prevents **Signal Collapse** (production outage) from environment variable mismatch or build-time tree-shaking.

---

## 8. SUPABASE CONFIGURATION

**Project URL:** `https://wiotrvoirdgzfacuuiem.supabase.co`

**Project ID:** `wiotrvoirdgzfacuuiem`

**API Keys:** Stored in `.env` (local) and Supabase Dashboard → Settings → API. Never commit secrets.

**Dashboard:** https://supabase.com/dashboard/project/wiotrvoirdgzfacuuiem

**Environment Variables (Vercel/Vite):**
- `VITE_SUPABASE_URL` = https://wiotrvoirdgzfacuuiem.supabase.co
- `VITE_SUPABASE_PUBLISHABLE_KEY` = from Supabase Dashboard or .env

**CRITICAL:** Environment variable is `VITE_SUPABASE_PUBLISHABLE_KEY`, not `VITE_SUPABASE_ANON_KEY`.

### Supabase Client Usage
**ALWAYS use the shared client:**
```typescript
import { supabase } from '@/integrations/supabase/client'
```

**NEVER create a new client:** Creating multiple clients causes "Multiple GoTrueClient instances" warning, session sharing failures, and authentication state not persisting.

### Query Limits
Supabase returns max 1,000 rows by default. **Always paginate.**

### Edge Function Timeout
60 seconds. Keep batch sizes small (5-10 for API-heavy operations).

---

## 9. URL RULES (FROZEN)

### The Only Valid Domain
```
https://www.top10lists.us
```
Not `top10lists.us`. Not `http://`. Always `www.`.

### URL Patterns (LOCKED)
```
/arizona/top10realestateagents                           # State
/arizona/scottsdale/top10realestateagents                # City
/arizona/scottsdale/85255/greyhawk/top10realestateagents # Neighborhood (5 segments)
/p/[shortcode]                                           # Agent profile
/:stateSlug/agents/:canonicalSlug                        # Canonical agent profile
```

Do not change these patterns. Routing is FROZEN. If you think routing is broken: STOP, report current path and rendering component, wait for "ROUTING CHANGE APPROVED:"

---

## 10. DATABASE RULES

### Never Do Without Explicit Approval
- Add, remove, or rename any column or table
- Change column types or enum values
- Delete or truncate data
- Overwrite existing data with NULL

### Data That Cannot Be Lost
These fields cost real money to generate:
- `synthesized_bio`, `review_stars_rating`, `num_total_reviews`
- `license_number`, `email`, `phone`, `website`
- `years_experience`, `specialty`, `community_roles`
- `press_mentions`, `notable_achievements`
- `primary_zip`, `nearby_neighborhoods`

### The Preserve Rule
If a field has data, your code must preserve existing values. Never write NULL unless explicitly clearing.

---

## 11. AGENT QUALIFICATION

### Prequalification Requirements
- 4.8+ star rating AND 20+ reviews

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

## 12. PRICING MODEL

### Cities (Free Tier)
No charge for city-level placement.

### Neighborhoods (Paid Tier)
Based on Census ACS income/home value data:
- **Main:** $25/month
- **Prime:** $50/month
- **Luxury:** $75/month

---

## 13. ENRICHMENT & API

### Supabase Edge Function: enrichment-api
**Endpoint:** `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api`

**Authentication:** Header `X-Enrichment-Key` (from .env or Supabase secrets)

**Key Actions:** `?action=audit`, `?action=fetch-neighborhoods&limit=100&offset=0`, `POST ?action=bulk-update`, `POST ?action=query`

### AI Services
| Service | Use |
|---------|-----|
| Anthropic | Prime/Luxury content |
| DeepSeek | Main tier (90% cheaper), synthesis |
| OpenAI | Fallback |
| Perplexity | DEPRECATED - avoid |
| Gemini | DO NOT USE (403 errors) |

### Enrichment Pipeline
- **Exa.ai:** Zillow profile ID discovery
- **Apify memo23:** Zillow profile enrichment
- **DeepSeek:** Content synthesis
- **Census geocoding:** `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x={lon}&y={lat}&benchmark=2020&vintage=2020&layers=all&format=json`

---

## 14. CRM LEADS SYSTEM

**Status:** Fully deployed and operational

**Database Table:** `crm_leads`

**Edge Function:** `process-review-request`
- Receives: `{name, email, zillowUrl}` from "Are You An Agent?" form
- Creates lead with status='new'
- Returns: `{success, leadId, alreadyQualified}`

**Status Workflow:** new → reviewing → qualified | disqualified | contacted → certified

---

## 15. ADMIN CRM DASHBOARD

**Routes:** `/admin/crm/login`, `/admin/crm/dashboard`, `/admin/crm/agents`, `/admin/crm/leads`

**Superadmin:** robert@aryah.ai (UUID: cabfb11c-dbaa-4af2-81b9-15e4bd097400)

**Admin routes:** Blocked on production (www.top10lists.us) via vercel.json and AdminRouteGuard.

---

## 16. VERIFICATION REQUIREMENTS

### The 5-Page Test (After ANY Change)
1. Homepage
2. /arizona/scottsdale/top10realestateagents
3. /arizona/scottsdale/85255/greyhawk/top10realestateagents
4. A random agent profile
5. /about

If any fails, STOP and fix.

### For Data Operations
- Ran 10-record test batch first
- Spot-checked 5 random records after
- No NULL values where data should exist

### Bot Test
```bash
curl -A "Googlebot" "https://www.top10lists.us/[path]"
```
Must return full HTML content, not React shell.

---

## 17. DEPRECATED SERVICES - DO NOT USE

| Service | Replacement | Reason |
|---------|-------------|--------|
| Perplexity API | DeepSeek | Cost |
| Gemini API | DeepSeek | 403 errors |
| Resend | Google Workspace | Reliability |
| Cloudflare Worker (bot rendering) | Vercel / Edge Functions | Architecture change |
| Old Supabase (bgdtekbhelormzbymkhh) | wiotrvoirdgzfacuuiem | Migration |
| Pipedrive | Custom CRM Dashboard | Cost, flexibility |
| PrivateEmail, Zoho Mail | Google Workspace | Outreach compatibility |

---

## 18. OPERATIONAL PROTOCOL

### Command Format
All commands must be exact copy/paste ready. No placeholders in brackets. Use actual paths and values.

### Testing Before Claiming Done
1. Deploy the change
2. Test with curl/API/browser
3. Verify result is correct
4. ONLY THEN report done

**Never say "done" without testing it yourself first.**

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

### Writing Style
- No em dashes. Ever.
- No marketing language or hype
- Short declarative sentences
- State facts, not promises

---

## 19. SHORTHAND & COMMANDS

### Shorthand
- **ryt** = "Remember your knowledge" - Update MASTER_KNOWLEDGE_DOCUMENT.md with session knowledge
- **takeaways** = Run the takeaways function (identify operational facts, update knowledge)

### Takeaways Function
When Robert says "run takeaways" or "takeaways":
1. Identify information that belongs in project knowledge
2. Read existing `MASTER_KNOWLEDGE_DOCUMENT.md`
3. Integrate new information, deprecate outdated
4. Update version and date
5. Write back to `MASTER_KNOWLEDGE_DOCUMENT.md`
6. Commit and push to staging

Do NOT write a summary in chat. Include: config changes, new infrastructure, deprecated patterns, hard stops from mistakes.

### Supabase CLI (Robert's Machine)
**CLI:** `C:\Users\rober\supabase.exe`

**Project:** `c:\Users\rober\list-wise-boost`

```bat
C:\Users\rober\supabase.exe functions deploy [name] --project-ref wiotrvoirdgzfacuuiem --no-verify-jwt
```

---

## 20. INSTRUCTIONS FOR AI AGENTS

1. **Sync State**: Read `MASTER_KNOWLEDGE_DOCUMENT.md` and `.cursorrules` before any code changes.
2. **Enforce Logic**: Ensure `calculateSignalStrength` uses logarithmic ranges (Listed 10-25, Certified 26-45, Accredited 46-75, Underwritten 76-100).
3. **Format Check**: "For AI" content = Raw Markdown in `<pre><code>` only.
4. **Pre-Flight**: Before merging staging to main, run `VITE_IS_PRODUCTION=1 npm run build` and confirm `npm run preview` loads.
5. **Final Rules**: If it works and user didn't ask to change it, don't touch it. When in doubt, ask. "Done!" without verification is not done. Test before deploy. Always.

---

*Version 4.0 - February 21, 2026*
*Merged from MASTER_KNOWLEDGE_DOCUMENT.md (North Star Protocol) and docs/TOP10LISTS-COMPLETE-KNOWLEDGE.md. Deprecated content removed. Single source of truth at repo root.*
