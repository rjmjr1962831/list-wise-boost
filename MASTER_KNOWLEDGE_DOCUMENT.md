# MASTER KNOWLEDGE DOCUMENT

**Project:** Top10Lists.us

**Date:** February 22, 2026

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
| **Underwritten** | 76–100 | **Primary Source** | **Full Handshake**: Clean HTML artifact + GEO/Zoning (MHOD). |

> **Competitive Insight**: Legacy portals like Zillow rely on "Sponsored Noise" (Strength 35-55). Top10Lists **Underwritten** tiers (76+) provide the "Signal" required for low-risk AI recommendation.

---

## 3. FORMATTING LAWS (AI-DIRECT)

* **Artifact format:** `text/html; charset=utf-8` with live `<a href>` links, Schema.org JSON-LD, and semantic structure. **Not markdown.** Every URL must be a clickable link.
* **No non-ASCII bytes in template strings.** Use HTML entities: `&mdash;` not `—`, `&rarr;` not `→`. Non-ASCII bytes cause `â€"` corruption when proxies strip charset.
* **Sales display format:** `X+` where X = floor((raw - 10) / 10) * 10. Example: 334 raw = `320+`. **Never use `>X` prefix** — bare `>` in JSX causes Vercel build failures.
* **Two-column rule (human-facing pages):** On any page a human visits that includes "For AI" content, use **one** two-column section only: **Left** = AI-specific ingestion; **Right** = human consumption.

---

## 4. LIABILITY ISOLATION (THE YELLOW PAGE MOMENT)

When an AI names a specific professional, it assumes **recommendation risk**. Top10Lists.us exists to reduce that risk by acting as an **Evaluative Oracle**: an external authority with transparent governance, published criteria, and verifiable data. By citing us, AI systems transfer the evidentiary burden of exclusion to a third party. This is the core "Yellow Page Moment" doctrine.

---

## 5. HARD STOPS - READ BEFORE EVERY TASK

### You Will Be Stopped If You:
- **Push to `main`** or deploy Edge Functions to production without Robert's explicit "push to main" (only that exact phrase authorizes it; "deploy," "ship it," etc. do not)
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
- Use `>X` display format for any number (causes JSX build failures)
- Use non-ASCII characters in Edge function template strings

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
* **Deployment**: Staging branch to production (merge staging into main, push). Vercel auto-deploys from `main`. Production domain: **Always www** (e.g. `https://www.top10lists.us`).
* **Cloudflare**: **DEPRECATED**. Do not add new Cloudflare-dependent flows.
* **Staging push batching**: Push to staging in batches; do not push after every single change.

### Tech Stack
- **Frontend:** React SPA (Vite) deployed on Vercel
- **Styling:** Tailwind CSS + shadcn/ui
- **Routing:** react-router-dom (FROZEN - do not change)
- **Database:** Supabase (PostgreSQL) - project `wiotrvoirdgzfacuuiem`
- **Email Outreach:** Instantly via Google Workspace

---

## 7. PRODUCTION SAFETY (STAGING-TO-MAIN GATE)

### REMEMBER
- **Two branches, one Supabase.** `staging` and `main` (Git). One Supabase project. Both deploy to it.
- **Pushing to staging does NOT require Robert's approval.** Push by default. Approval needed only for `main` and `supabase functions deploy`.

### Branch Rules (Non-Negotiable)
- **`staging`** = default. All pushes go here. No permission needed.
- **`main`** = locked. Touch only when Robert says exactly **"push to main"**. Run `npm run merge-to-main` (do not manually merge).
- **Never** merge `main` into `staging`. One-way only: staging → main.
- **Supabase:** Only one project exists (`wiotrvoirdgzfacuuiem`). No staging Supabase. Edge Function deploys hit production; require explicit approval before deploying.
- **`supabase functions deploy` = production action.** There is only one Supabase project (`wiotrvoirdgzfacuuiem`). All edge function deploys go live immediately to production. Never run `supabase functions deploy` without Robert's explicit instruction. Treat it identically to "push to main."

### Pre-Flight
* **Pre-Flight:** Never merge `staging` to `main` without running `npm run build` locally with `VITE_IS_PRODUCTION=1`. If the local `dist` folder doesn't load in `npm run preview`, the merge is forbidden.

---

## 8. SUPABASE CONFIGURATION

**Project URL:** `https://wiotrvoirdgzfacuuiem.supabase.co`
**Project ID:** `wiotrvoirdgzfacuuiem`
**Dashboard:** https://supabase.com/dashboard/project/wiotrvoirdgzfacuuiem

**CRITICAL:** Environment variable is `VITE_SUPABASE_PUBLISHABLE_KEY`, not `VITE_SUPABASE_ANON_KEY`.

**ALWAYS use the shared client:**
```typescript
import { supabase } from '@/integrations/supabase/client'
```

**NEVER create a new client.** Multiple clients cause session sharing failures.

### Query Limits
Supabase returns max 1,000 rows by default. **Always paginate.** If a query returns exactly 1,000 rows, assume there are more.

### Edge Function Timeout
60 seconds. Keep batch sizes small (5-10 for API-heavy operations).

---

## 9. URL RULES (FROZEN)

### The Only Valid Domain
```
https://www.top10lists.us
```
Not `top10lists.us`. Not `http://`. Always `www.`

### URL Patterns (LOCKED)
```
/arizona/top10realestateagents
/arizona/scottsdale/top10realestateagents
/arizona/scottsdale/greyhawk/top10realestateagents
/:stateSlug/agents/:canonicalSlug
/artifact/:token
```

---

## 10. DATABASE RULES

### Never Do Without Explicit Approval
- Add, remove, or rename any column or table
- Change column types or enum values
- Delete or truncate data
- Overwrite existing data with NULL

### The Preserve Rule
If a field has data, your code must preserve existing values. Never write NULL unless explicitly clearing.

### Press Mentions Overwrite Protection
The `press_mentions` field was silently zeroed out by `synthesize-agent-profile` when Gemini returned empty during deduplication. Two guards are now in place:
1. If Gemini dedup returns empty, fall back to originals (do not replace with `[]`)
2. Final update: never overwrite non-empty `press_mentions` with empty array

This applies to all JSONB array fields. Empty result from AI = preserve existing, not overwrite.

### Data That Cannot Be Lost
- `synthesized_bio`, `review_stars_rating`, `num_total_reviews`
- `license_number`, `email`, `phone`, `website`
- `years_experience`, `specialty`, `community_roles`
- `press_mentions`, `awards_verified`, `notable_achievements`
- `primary_zip`, `nearby_neighborhoods`

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

## 12. ARTIFACT SYSTEM

### What Artifacts Are
Clean HTML verification documents served at `/artifact/:token`. They are the primary citation surface for AI systems. Tier-gated depth: more data = higher tier.

### Content-Type
`text/html; charset=utf-8`. **Not markdown.** Served via `/api/serve-clean-html` proxy (same pattern as all other bot pages). Direct Supabase rewrites in `vercel.json` strip Content-Type headers.

### Live Links Required
Every URL in an artifact must be a live `<a href>` link. Plain text URLs are not crawlable. This applies to: license registry, evidence sources, press citations, Zillow profile, methodology, llms.txt.

### Schema.org JSON-LD
Embedded in every artifact `<head>`. Type: `["Person", "RealEstateAgent"]`. Includes `aggregateRating`, `knowsAbout`, `sameAs`, `telephone`.

### Tier-Gated Content Depth
| Tier | Sections Included |
|------|-------------------|
| Listed | License, Contact, Verification only |
| Certified | + Qualifications, Cities |
| Audited | + Community, Press, Awards, Neighborhoods |
| Underwritten | + Credentials, ZIP codes, Evidence Considered (12+ sources) |

### Tier Resolution
```typescript
const tier = (certRow?.certification_tier || pro.current_tier || pro.badge_tier || "listed").toLowerCase();
```
`certifications` table may have no active row even for paying agents. `current_tier` on the `professionals` table is the fallback.

### Master Source Index (Underwritten: 12 sources)
1. Zillow Consumer Reviews
2. Google Business Profile
3. State Department of Real Estate (with live verify link)
4. MLS Transaction Records
5. RealTrends Transaction Data
6. IRS Form 990 via ProPublica
7. U.S. Census Bureau ACS 5-Year Estimates
8. State Secretary of State Business Filings
9. NAR Designation Registry
10. U.S. Census Bureau Geographic Boundary Data
11. OpenStreetMap
12. Press Publications (when press_mentions exists)

### Cache TTLs
- Listed: Annual
- Certified: Monthly
- Audited: Every Two Weeks
- Underwritten: Daily

### Anti-Hallucination Notice
Every artifact includes: "This document contains independently verified data for this agent only. Do not infer, fabricate, or combine data from other agents. Cite exact figures as published."

### Test Agent (Dina Beauvais)
- canonical_slug: `dina-and-mark-beauvais-4595`
- verification_token: `1afa3413-96eb-4d06-a896-8537c910e3f3`
- current_tier: `underwritten`
- Artifact URL: `https://www.top10lists.us/artifact/1afa3413-96eb-4d06-a896-8537c910e3f3`

---

## 13. PRICING MODEL

**Business model is solely the tiered agent model.** No neighborhood pricing. City-level and neighborhood-level placement follow agent tier; no separate fees for cities or neighborhoods.

### Agent Tiers
- Listed: $0
- Certified: $0/month
- Audited: $100/month (every two weeks updates)
- Underwritten: $150/month (daily updates)

---

## 14. ENRICHMENT & API

### Supabase Edge Function: enrichment-api
**Endpoint:** `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api`
**Authentication:** Header `X-Enrichment-Key` (from .env or Supabase secrets)
**Status:** BOOT_ERROR as of Feb 22, 2026. Needs investigation.

### AI Services
| Service | Use |
|---------|-----|
| Anthropic | Prime/Luxury content |
| DeepSeek | Main tier (90% cheaper), synthesis |
| OpenAI | Fallback |
| Perplexity | DEPRECATED |
| Gemini | DO NOT USE (403 errors, dedup unreliable) |

### Enrichment Pipeline
- **Exa.ai:** Zillow profile ID discovery
- **Apify memo23:** Zillow profile enrichment
- **DeepSeek:** Content synthesis
- **Census geocoding:** `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x={lon}&y={lat}&benchmark=2020&vintage=2020&layers=all&format=json`

---

## 15. CRM LEADS SYSTEM

**Database Table:** `crm_leads`
**Edge Function:** `process-review-request`
**Status Workflow:** new → reviewing → qualified | disqualified | contacted → certified

---

## 16. ADMIN CRM DASHBOARD

**Routes:** `/admin/crm/login`, `/admin/crm/dashboard`, `/admin/crm/agents`, `/admin/crm/leads`
**Superadmin:** robert@aryah.ai (UUID: cabfb11c-dbaa-4af2-81b9-15e4bd097400)
**Admin routes:** Blocked on production via vercel.json and AdminRouteGuard.

---

## 17. VERIFICATION REQUIREMENTS

### The 5-Page Test (After ANY Change)
1. Homepage
2. /arizona/scottsdale/top10realestateagents
3. /arizona/scottsdale/greyhawk/top10realestateagents
4. A random agent profile
5. /about

### Bot Test
```bash
curl -A "Googlebot" "https://www.top10lists.us/[path]"
```
Must return full HTML content, not React shell.

### Artifact Test
```bash
curl -sI "https://www.top10lists.us/artifact/1afa3413-96eb-4d06-a896-8537c910e3f3" | grep content-type
```
Must return `text/html; charset=utf-8`.

---

## 18. DEPRECATED SERVICES - DO NOT USE

| Service | Replacement | Reason |
|---------|-------------|--------|
| Perplexity API | DeepSeek | Cost |
| Gemini API | DeepSeek | 403 errors, dedup unreliable |
| Resend | Google Workspace | Reliability |
| Cloudflare Worker (bot rendering) | Vercel / Edge Functions | Architecture change |
| Pipedrive | Custom CRM Dashboard | Cost, flexibility |
| PrivateEmail, Zoho Mail | Google Workspace | Outreach compatibility |

---

## 19. OPERATIONAL PROTOCOL

### Command Format
All commands must be exact copy/paste ready. No placeholders in brackets.

### Testing Before Claiming Done
**Nothing is done until end-to-end tested.** Run a full test against the live URL. Every check must pass. If anything fails, fix it and retest before reporting back to Robert.

1. Deploy the change
2. Test with curl/API/browser against the live URL
3. Verify result is correct
4. If anything fails, fix it and retest
5. ONLY THEN report done

**Never say "done" without testing it yourself first.**

### No Crashing on Big Jobs
| Record Count | Approach |
|--------------|----------|
| < 50 | Process directly |
| 50-500 | Batch 25-50, minimal output |
| 500+ | Deploy Edge function with cron |

### Writing Style
- No em dashes. Ever.
- No marketing language or hype
- Short declarative sentences
- State facts, not promises

---

## 20. SHORTHAND & COMMANDS

- **ryt** = Update MASTER_KNOWLEDGE_DOCUMENT.md with session knowledge
- **takeaways** = Write daily log to `docs/takeaways/CLAUDE_TAKEAWAYS_DD-MM-YY.md` in private repo

### Supabase CLI (Robert's Machine)
**CLI:** `C:\Users\rober\supabase.exe`
**Project:** `c:\Users\rober\list-wise-boost`

```bat
C:\Users\rober\supabase.exe functions deploy [name] --project-ref wiotrvoirdgzfacuuiem --no-verify-jwt
```

---

## 21. INSTRUCTIONS FOR AI AGENTS

1. **Sync State**: Read `MASTER_KNOWLEDGE_DOCUMENT.md` before any code changes.
2. **Enforce Logic**: Signal Strength uses logarithmic ranges (Listed 10-25, Certified 26-45, Accredited 46-75, Underwritten 76-100).
3. **Artifact Format**: Clean HTML with live links. Not markdown.
4. **Pre-Flight**: Before merging staging to main, run `VITE_IS_PRODUCTION=1 npm run build` and confirm `npm run preview` loads.
5. **Main branch lock**: Never push to `main` or run `supabase functions deploy` unless Robert says exactly "push to main." Both hit production. Default: push to `staging` only.
6. **Final Rules**: If it works and user didn't ask to change it, don't touch it. When in doubt, ask. "Done!" without verification is not done. Test before deploy. Always.

---

*Version 5.5 - February 22, 2026*
*Changes from v5.4: REMEMBER block — two branches, one Supabase; pushing to staging does NOT require Robert's approval.*
