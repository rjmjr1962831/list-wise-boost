# MASTER KNOWLEDGE DOCUMENT

**Project:** Top10Lists.us

**Date:** February 24, 2026

**Context:** Single Source of Truth (SSoT) for AI agents (Cursor, Claude, Gemini). Combines all Cursor rules, staging/git flow, verification protocol, and Gemini migration. Every rule exists because something broke. **On conflict, the most recent entry wins; earlier conflicting statements are deprecated.**

**Location:** Repo root `MASTER_KNOWLEDGE_DOCUMENT_TODAY.MD`. Must **never** be served on the website or deployed to any public URL. Cursor rule files (`.cursor/rules/*.mdc`) reference this document; do not duplicate full content there.

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

## 2. CREDENTIALS AND AUTHORITY

**Do what you can yourself.** Each AI has the credentials needed for every major system (Supabase, GitHub, Vercel, enrichment API, warm/purge, etc.). They are in project `.env`, `.secrets/`, or Supabase/Vercel config. Use them. Do not ask Robert to run commands, deploy, push, or call APIs you can do. Only ask when you lack access or explicit approval is required (e.g. push to main).

---

## 3. THE NORTH STAR (GEO-FIRST)

This site is built for maximum **GEO (Generative Engine Optimization)**. Every decision must be filtered through the lens of AI extractability and citation. If an implementation causes unexpected consequences for AI crawlers, surface it to Robert immediately.

---

## 4. SIGNAL STRENGTH (LOGARITHMIC SCALE)

Signal Strength (0-100) represents the probability of AI citation based on data provenance. It is **not linear**. *(Accredited = Audited tier.)*

| Tier | Range | Discovery Level | Technical Requirement |
| --- | --- | --- | --- |
| **Listed** | 10–25 | **Ambient** | Passive index entry; minimal data. |
| **Certified** | 26–45 | **Recognized** | **4.8+ Gate Cleared**; valid node in the graph. |
| **Accredited / Audited** | 46–75 | **Authority** | **Payload Boost**: License verified; data freshness <30 days. |
| **Underwritten** | 76–100 | **Primary Source** | **Full Handshake**: Clean HTML artifact + GEO/Zoning (MHOD). |

> **Competitive Insight**: Legacy portals like Zillow rely on "Sponsored Noise" (Strength 35-55). Top10Lists **Underwritten** tiers (76+) provide the "Signal" required for low-risk AI recommendation.

---

## 5. URLS AND LINKS

- **Base URL:** **https://www.top10lists.us** (always www; never http or bare domain).
- **When sharing with Robert:** Always give full URLs as markdown links: `[descriptive text](https://full-url)`. No placeholders like "your staging host" or bare paths. Example: [Phoenix city page](https://www.top10lists.us/arizona/phoenix/top10realestateagents).
- **In code/terminal:** Plain URLs in commands are fine.

---

## 6. FORMATTING LAWS (AI-DIRECT)

* **Artifact format:** `text/html; charset=utf-8` with live `<a href>` links, Schema.org JSON-LD, and semantic structure. **Not markdown.** Every URL must be a clickable link.
* **No non-ASCII bytes in template strings.** Use HTML entities: `&mdash;` not `—`, `&rarr;` not `→`. Non-ASCII bytes cause `â€"` corruption when proxies strip charset.
* **Sales display format:** `X+` where X = floor((raw - 10) / 10) * 10. Example: 334 raw = `320+`. **Never use `>X` prefix** — bare `>` in JSX causes Vercel build failures.
* **Two-column rule (human-facing pages):** On any page a human visits that includes "For AI" content, use **one** two-column section only: **Left** = AI-specific ingestion; **Right** = human consumption.

---

## 7. LIABILITY ISOLATION (THE YELLOW PAGE MOMENT)

When an AI names a specific professional, it assumes **recommendation risk**. Top10Lists.us exists to reduce that risk by acting as an **Evaluative Oracle**: an external authority with transparent governance, published criteria, and verifiable data. By citing us, AI systems transfer the evidentiary burden of exclusion to a third party.

---

## 8. HARD STOPS - READ BEFORE EVERY TASK

### You Will Be Stopped If You:
- **Push to `main`** or deploy Edge Functions to production without Robert's explicit **"push to main"** (only that exact phrase; "deploy," "ship it," etc. do not authorize it)
- **Manually merge staging to main** — use `npm run merge-to-main` so internal documents are excluded. Manual merge pushes internal docs to production; forbidden.
- **Push anything in `src/pages/admin/` or CRM/admin folders to `main`** — nothing in crm or admin folders should be pushed to main. Admin and CRM are staging-only. Use `npm run merge-to-main`; ensure admin/crm paths are excluded.
- **Tell Robert to push internal docs to main** after updating them — that creates a loop; say nothing about pushing to main.
- Touch routing without "ROUTING CHANGE APPROVED:" in the message
- Touch database schema without explicit approval
- Touch `is_brand_builder` field for any reason
- Use Resend, Perplexity, or any deprecated service
- Use **Gemini 2.0** for new or existing flows (see Gemini section below)
- Create individual page files for cities/states/neighborhoods
- Use non-www URLs anywhere
- Run bulk operations without a 10-record test first
- Mark a task "done" without verification (see Verification Protocol)
- Crash on big jobs (batch them, use Edge functions)
- Create a new Supabase client (use shared client from `@/integrations/supabase/client`)
- Provide commands that require user editing (all commands must be exact copy-paste ready)
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

## 9. VERIFICATION PROTOCOL

**You are not done until you confirm the change actually worked.**

- Deploy the change (commit, push, wait for build).
- Load the actual live page or endpoint (curl/browser) and verify the specific thing you changed.
- **Code changes alone are not completion.** Deployment + verification = completion.
- If you cannot verify (e.g. no browser), say: "Changes deployed. Cannot verify without [browser/auth]. Please check [URL] for [specific element]."
- Never say "done" without end-to-end testing when possible.

---

## 10. GIT / BRANCH FLOW (STAGING → MAIN)

- **Two branches, one Supabase.** `staging` and `main`. One Supabase project. Both deploy to it.
- **Pushing to staging does NOT require Robert's approval.** Push to staging by default when you complete work. Do not ask.
- **Staging push batching:** Push in **batches of ten** changes. Accumulate commits and push together; do not push after every single change.
- **Branch direction (locked):** Only **staging → main**. Never merge or deploy **main** into **staging**.
- **Main / production:** Touch only when Robert says exactly **"push to main"**. Run `npm run merge-to-main` (script merges staging, excludes internal docs, pushes main). Do not manually merge and push.
- **Internal documents** (this file, PENDING_UPDATES.md, docs/cursor-daily-updates.md, etc.) are excluded from main via `scripts/internal-documents.txt`. They remain on staging only.
- **Admin / CRM:** Admin login and `/admin/*` must not be reachable on production. `vercel.json` redirects and `AdminRouteGuard` enforce this. **Nothing in `src/pages/admin/` or CRM/admin folders must be pushed to main.** Admin and CRM code is staging-only. When merging staging to main, do not include admin/crm changes. (Note: Full exclusion requires build restructuring so production does not import admin routes.)

---

## 11. CURRENT ARCHITECTURAL STATE

* **Sitemap**: Dynamic and filtered by the 4.8+ merit gate.
* **Manual Audit**: Accessible via `/api/audit-sitemap` to verify 10,000+ pages via random sampling.
* **Deployment**: Staging branch to production (merge via `npm run merge-to-main`). Vercel auto-deploys from `main`. Production domain: **Always www** (e.g. **https://www.top10lists.us**).
* **BuildCommand:** `NODE_OPTIONS=--max-old-space-size=8192 npm run build` in vercel.json to avoid Vercel memory limits.
* **Cloudflare:** **DEPRECATED.** Do not add new Cloudflare-dependent flows.

### Tech Stack
- **Frontend:** React SPA (Vite) deployed on Vercel
- **Styling:** Tailwind CSS + shadcn/ui
- **Routing:** react-router-dom (FROZEN - do not change)
- **Database:** Supabase (PostgreSQL) - project `wiotrvoirdgzfacuuiem`
- **Email Outreach:** Instantly via Google Workspace

### Pre-Flight Before Merge to Main
Run `VITE_IS_PRODUCTION=1 npm run build` locally. If `dist` doesn't load in `npm run preview`, the merge is forbidden.

### Home Page (Index.tsx)
Do not change layout or spacing unless Robert explicitly requests it. Safe to change: copy, meta tags, challenge question, links. Do not change section `py-*` or structure.

---

## 12. SUPABASE CONFIGURATION

**Project URL:** `https://wiotrvoirdgzfacuuiem.supabase.co`
**Project ID:** `wiotrvoirdgzfacuuiem`
**Dashboard:** https://supabase.com/dashboard/project/wiotrvoirdgzfacuuiem

**CRITICAL:** Environment variable is `VITE_SUPABASE_PUBLISHABLE_KEY`, not `VITE_SUPABASE_ANON_KEY`.

**ALWAYS use the shared client:**
```typescript
import { supabase } from '@/integrations/supabase/client'
```
**NEVER create a new client.** Multiple clients cause session sharing failures.

### Pagination (CRITICAL)
Supabase returns **max 1,000 rows** by default. Always paginate when querying large tables. If a query returns exactly 1,000 rows, assume there are more. Tables that require pagination: `professionals`, `neighborhood_catalog`; watch `cities`, `agent_neighborhood_subscriptions`, `funnel_analytics` as they grow. Use `.range(offset, offset + pageSize - 1)` in a loop until `data.length < pageSize`.

### Edge Function Timeout
60 seconds. Keep batch sizes small (5-10 for API-heavy operations).

---

## 13. URL RULES (FROZEN)

### The Only Valid Domain
```
https://www.top10lists.us
```

### URL Patterns (LOCKED)
```
/arizona/top10realestateagents
/arizona/scottsdale/top10realestateagents
/arizona/scottsdale/greyhawk/top10realestateagents
/:stateSlug/agents/:canonicalSlug
/artifact/:token
```

---

## 14. DATABASE RULES

### Never Do Without Explicit Approval
- Add, remove, or rename any column or table
- Change column types or enum values
- Delete or truncate data
- Overwrite existing data with NULL

### The Preserve Rule
If a field has data, your code must preserve existing values. Never write NULL unless explicitly clearing.

### Press Mentions / JSONB Overwrite Protection
Empty AI result must not overwrite non-empty arrays. If synthesis returns empty, fall back to originals. Never overwrite non-empty `press_mentions` (or other JSONB array fields) with `[]`.

### Data That Cannot Be Lost
- `synthesized_bio`, `review_stars_rating`, `num_total_reviews`
- `license_number`, `email`, `phone`, `website`
- `years_experience`, `specialty`, `community_roles`
- `press_mentions`, `awards_verified`, `notable_achievements`
- `primary_zip`, `nearby_neighborhoods`

---

## 15. BUSINESS MODEL (SSoT)

**Tiered agent model only.** No neighborhood pricing. City and neighborhood placement follow agent tier.

| Tier | Price | Notes |
|------|--------|--------|
| **Listed** | $0 | Public data only. **NO Artifact/Badge issued.** |
| **Certified** | $0 | Agent-verified. Standard Artifact issued. |
| **Audited** | $100/mo | Every two weeks diligence. Enhanced AI Payload. |
| **Underwritten** | $150/mo | Daily refresh. Maximum AI Reasoning & Neighborhood Depth. |

**Citation:** Top 1% merit (1.1M records). Content delivered in 40–60 word atomic "fact nuggets" for AI legibility.

---

## 16. AGENT QUALIFICATION

### Prequalification
- 4.8+ star rating AND 20+ reviews

### Ranking Weights
- Community: 25% | Rating: 25% | Reviews: 20% | Transactions: 20% | Education: 10%

### Pinned Agents (LOCKED)
Only these may have `is_brand_builder = true`:
| Agent | City | Notes |
|-------|------|-------|
| Dina And Mark Beauvais | Scottsdale | Must be #1 |
| Eileen Taggart | Flagstaff | First customer |

Do not change without "PIN [Agent Name] TO [City Name]" in message.

---

## 17. ARTIFACT SYSTEM

### What Artifacts Are
Clean HTML verification documents at `/artifact/:token`. Tier-gated depth. Content-Type: `text/html; charset=utf-8`. **Not markdown.** Served via `/api/serve-clean-html` proxy.

### Live Links Required
Every URL in an artifact must be a live `<a href>`. Schema.org JSON-LD in `<head>`: `["Person", "RealEstateAgent"]`, includes `aggregateRating`, `knowsAbout`, `sameAs`, `telephone`.

### Tier-Gated Content Depth
| Tier | Sections |
|------|----------|
| Listed | License, Contact, Verification only |
| Certified | + Qualifications, Cities |
| Audited | + Community, Press, Awards, Neighborhoods |
| Underwritten | + Credentials, ZIP codes, Evidence Considered (12+ sources) |

### Tier Resolution
`current_tier` or `badge_tier` on `professionals`; fallback `listed`. Cache TTLs: Listed annual, Certified monthly, Audited every two weeks, Underwritten daily.

### Test Agent (Dina Beauvais)
- canonical_slug: `dina-and-mark-beauvais-4595`
- verification_token: `1afa3413-96eb-4d06-a896-8537c910e3f3`
- Artifact URL: [Dina Beauvais artifact](https://www.top10lists.us/artifact/1afa3413-96eb-4d06-a896-8537c910e3f3)

---

## 18. ENRICHMENT & AI SERVICES

### Supabase Edge Function: enrichment-api
**Endpoint:** `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api`
**Auth:** Header `X-Enrichment-Key` (from .env or Supabase secrets)
**Status:** BOOT_ERROR as of Feb 22, 2026. Needs investigation.

### AI Services (LIVE)
| Service | Use |
|---------|-----|
| Anthropic | Prime/Luxury content |
| DeepSeek | Main tier (90% cheaper), synthesis. Use `deepseek-chat`, Temperature **0.6**. |
| OpenAI | Fallback |

### MIME / Authority
- `/ai-feed/*.md` and root `/llms.txt` MUST return raw text/markdown. No HTML wrapping.
- Legacy paths (e.g. `/for-ai`) must 301-redirect to `/ai-feed/` equivalents.

### Gemini (DEPRECATED for new use; migration for existing)
- **Current policy:** Do not use Gemini for new flows (403 errors, dedup unreliable in the past). Prefer DeepSeek.
- **Where Gemini is still used (e.g. neighborhood writeups, enrich coords):** Use **2.5 Flash / 2.5 Flash Lite only**. **Gemini 2.0 is retired June 1, 2026.** Replace `gemini-2.0-flash` / `gemini-2.0-flash-exp` with `gemini-2.5-flash` in the 7 Edge Functions listed in `docs/gemini-2-to-2.5-migration-plan.md`. Add a one-line note in project docs: "Gemini: use 2.5 Flash / 2.5 Flash Lite only; 2.0 retired Jun 2026."

### Enrichment Pipeline
- **Exa.ai:** Zillow profile ID discovery
- **Apify memo23:** Zillow profile enrichment
- **DeepSeek:** Content synthesis
- **Census geocoding:** `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x={lon}&y={lat}&benchmark=2020&vintage=2020&layers=all&format=json`

---

## 19. DEPRECATED SERVICES - DO NOT USE

| Service | Replacement | Reason |
|---------|-------------|--------|
| Perplexity API | DeepSeek | Cost |
| Gemini 2.0 | Gemini 2.5 if retaining Gemini; else DeepSeek | 2.0 retired Jun 2026; 403/dedup issues |
| Resend | Google Workspace | Reliability |
| Cloudflare Worker (bot rendering) | Vercel / Edge Functions | Architecture change |
| Pipedrive | Custom CRM Dashboard | Cost, flexibility |
| PrivateEmail, Zoho Mail | Google Workspace | Outreach compatibility |

---

## 20. CRM, ADMIN, OPERATIONS

**CRM:** Table `crm_leads`. Edge function `process-review-request`. Workflow: new → reviewing → qualified | disqualified | contacted → certified.

**Admin:** Routes `/admin/crm/login`, `/admin/crm/dashboard`, `/admin/crm/agents`, `/admin/crm/leads`, `/admin/crm/sequences`. Superadmin: robert@aryah.ai. Admin blocked on production (vercel.json + AdminRouteGuard).

### Email / gmail-send
- **Sending domain:** Use `robert@toptenlists.us` or `hello@toptenlists.us` only. Never `top10lists.us` (deliverability compromised).
- **Click tracking:** `/api/t` in vercel.json rewrites to Supabase `email-track`. gmail-send skips click-tracking for links to `top10lists.us` so magic links work on prod without going through `/api/t`.
- **Template format:** `[[BLOCK]]` / `[[/BLOCK]]` renders as styled callout; `[your profile]({{profile_url}})` renders as hyperlink.

**UI pattern:** For admin/testing URLs, verification tokens, profile links, use `CopyableLink` / `CopyableText` from `@/components/ui/copyable-link` so users can one-click copy. Toast on copy. Not required for normal nav links.

**No crashing on big jobs:** &lt; 50 direct; 50–500 batch 25–50; 500+ use Edge function with cron.

**Writing style:** No em dashes. No marketing hype. Short declarative sentences. State facts, not promises.

---

## 21. VERIFICATION REQUIREMENTS

### 5-Page Test (After ANY Change)
1. Homepage
2. /arizona/scottsdale/top10realestateagents
3. /arizona/scottsdale/greyhawk/top10realestateagents
4. A random agent profile
5. /about

### Bot Test
```bash
curl -A "Googlebot" "https://www.top10lists.us/[path]"
```
Must return full HTML, not React shell.

### Artifact Test
```bash
curl -sI "https://www.top10lists.us/artifact/1afa3413-96eb-4d06-a896-8537c910e3f3" | grep content-type
```
Must return `text/html; charset=utf-8`.

---

## 22. SHORTHAND & COMMANDS

- **ryt** = Update **this file only** (`MASTER_KNOWLEDGE_DOCUMENT_TODAY.MD`). Read it, integrate session knowledge, write back. Commit and push to staging. Do not update other knowledge files.
- **takeaways** = Generate structured outcomes (Key Outcomes, Config Changes, Deprecated/New Patterns, Version Bump). Use `npm run takeaways` for template. Output to `docs/cursor-daily-updates.md` or per Robert's preference. Master doc name in template is MASTER_KNOWLEDGE_DOCUMENT_TODAY.MD.
- **When Robert says "remember":** Add to `docs/cursor-daily-updates.md`.
- **update** = Run `npm run update` or fetch from private repo, merge session takeaways, write new version per project workflow (master doc in repo; other sync per Robert).
- **Command format:** All commands must be exact copy-paste ready. No placeholders in brackets.

### Supabase CLI (Robert's Machine)
**CLI:** `C:\Users\rober\supabase.exe`
**Project:** `c:\Users\rober\list-wise-boost`
```bat
C:\Users\rober\supabase.exe functions deploy [name] --project-ref wiotrvoirdgzfacuuiem --no-verify-jwt
```
**Note:** `supabase functions deploy` = production action. Same as "push to main." Require explicit instruction.

---

## 23. INSTRUCTIONS FOR AI AGENTS

1. **Sync state:** Read this file before code changes.
2. **Enforce logic:** Signal Strength logarithmic (Listed 10–25, Certified 26–45, Audited 46–75, Underwritten 76–100).
3. **Artifact format:** Clean HTML with live links. Not markdown.
4. **Pre-flight:** Before merge to main, run `VITE_IS_PRODUCTION=1 npm run build` and confirm `npm run preview` loads.
5. **Main lock:** Never push to `main` or run `supabase functions deploy` unless Robert says exactly "push to main." Default: push to `staging` only, in batches of ten.
6. **Verification:** Done = deployed + verified. Never say "done" without testing when you can.
7. **Links:** When sharing with Robert, use full URLs as markdown links: [text](https://www.top10lists.us/...).
8. **Conflicts:** If a rule elsewhere conflicts with this document, this document wins. Deprecate the earlier conflicting statement.

---

*Version 6.1 – February 27, 2026*
*Consolidated from MASTER_KNOWLEDGE_DOCUMENT_TODAY.MD, .cursor/rules (project-knowledge.mdc, links-exact-urls.mdc, staging-push.mdc, verification-protocol.mdc, ui-patterns.md, supabase-pagination.md), docs/gemini-2-to-2.5-migration-plan.md, and docs/cursor-daily-updates.md. Conflicts resolved with most recent as truth; deprecated entries omitted or noted.*
