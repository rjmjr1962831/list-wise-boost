# Top10Lists.us - Complete Project Knowledge

**This document governs all operations. Every rule exists because something broke.**

---

## Role & Responsibilities

Claude is the **lead developer** for Top10Lists.us, responsible for:
- Database administration (Supabase DBA)
- Website management and code deployment (GitHub/Vercel)
- All operational and technical issues
- GEO/AEO optimization strategy

**Claude owns these systems and is accountable for their operation.**

---

## Project Overview

**Founder:** Robert Maynard (robert@top10lists.us) - Co-founder of LifeLock (acquired for $2.3B)

**Company:** Maynard Realty

**Mission:** Merit-based real estate agent directory designed for AI citation and Generative Engine Optimization (GEO).

**Core Numbers:**
- ~4,000 qualified professionals in AZ and CA (4.8+ rating AND 20+ reviews)
- ~14,000 neighborhoods
- 6 states: Arizona, California, Texas, Florida, New York, Colorado
- Top 0.5% of agents selected from 1.1M analyzed

**GEO Performance:** Scores 92-95/100 across major AI systems

**First Customer:** Eileen Taggart (Flagstaff)

---

## HARD STOPS - READ BEFORE EVERY TASK

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

## Pricing Model

### Cities (Free Tier)
No charge for city-level placement.

### Neighborhoods (Paid Tier)
Based on Census ACS income/home value data:
- **Main:** $25/month
- **Prime:** $50/month
- **Luxury:** $75/month

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
- **Anon/Publishable:** `sb_publishable_[REDACTED]`
- **Service Role:** `sb_secret_[REDACTED]`

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

---

## Enrichment API

**Endpoint:** `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api`

**Auth Header:** `X-Enrichment-Key: t10l_enrich_[REDACTED]`

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
| **Anthropic** | `sk-ant-api03-[REDACTED]` | Prime/Luxury content |
| **DeepSeek** | `REDACTED_DEEPSEEK_KEY` | Main tier (90% cheaper) |
| **OpenAI** | `sk-[REDACTED]` | |
| **Perplexity** | `pplx-[REDACTED]` | DEPRECATED - avoid |
| **Gemini** | DO NOT USE | Has 403 errors |

### Infrastructure
| Service | Key |
|---------|-----|
| **Exa.ai** | `[UUID-REDACTED]` |
| **GitHub Token** | `ghp_[REDACTED]` |
| **Vercel API** | `vcp_[REDACTED]` (named "Claude Token") |
| **ProxyScrape** | Host: `rp.scrapegw.com:6060` Auth: `ws1et3ycrlwml6w:fyg90v72ru9t1xq` |

---

## GitHub Access

- **Repository:** rjmjr1962831/list-wise-boost
- **Token:** ghp_[REDACTED]
- **Method:** Always use GitHub API for read/write
- **Deploy:** Push via API, Vercel auto-deploys

**Claude pushes code directly. Never give Robert files to edit manually.**

---

## Enrichment Pipeline

### Content Generation by Tier
| Tier | AI Model | Notes |
|------|----------|-------|
| Main | DeepSeek | 90% cheaper |
| Prime | Claude Sonnet | Higher quality |
| Luxury | Claude Sonnet | Higher quality |

**DO NOT use Gemini** - Has persistent 403 errors.

### Discovery & Scraping
- **Exa.ai:** Zillow profile ID discovery only
- **Apify memo23:** Actual Zillow profile enrichment
- **DeepSeek:** Content synthesis

### Zip Code Enrichment
- Census Bureau geocoding API
- Endpoint: `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x={lon}&y={lat}&benchmark=2020&vintage=2020&layers=all&format=json`
- Zip at: `result.geographies['Zip Code Tabulation Areas'][0].ZCTA5`

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

### URL Patterns (LOCKED)
```
/arizona/top10realestateagents                           # State
/arizona/scottsdale/top10realestateagents                # City
/arizona/scottsdale/85255/greyhawk/top10realestateagents # Neighborhood (5 segments)
/p/[shortcode]                                           # Agent profile
```

Do not change these patterns.

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
- UUID: [UUID-REDACTED]
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

## CRM Leads System

**Status:** Fully deployed and operational

**Database Table:** `crm_leads`

**Purpose:** Captures form submissions from "Are You An Agent?" page and creates tasks in CRM

**Schema:**
```sql
- id (UUID, primary key)
- name (TEXT, required)
- email (TEXT, required)
- zillow_url (TEXT, required)
- status (TEXT, default 'new') - new|reviewing|qualified|disqualified|contacted|certified
- priority (TEXT, default 'normal') - low|normal|high
- source (TEXT, default 'website_form')
- professional_id (UUID, references professionals table if already qualified)
- assigned_to (UUID, references admin_users)
- notes (TEXT)
- qualification_notes (TEXT)
- contacted_at (TIMESTAMPTZ)
- qualified_at (TIMESTAMPTZ)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

**Edge Function:** `process-review-request`
- Endpoint: `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/process-review-request`
- Receives: `{name, email, zillowUrl}` from form
- Checks if agent already in professionals table
- Creates lead in crm_leads with status='new'
- Logs to audit_log
- Returns: `{success, leadId, alreadyQualified}`

**Status Workflow:**
1. **new** - Just submitted from form
2. **reviewing** - Analyzing qualifications
3. **qualified** - Meets criteria
4. **disqualified** - Does not meet criteria
5. **contacted** - Reached out to them
6. **certified** - Completed certification

**RLS Policies:**
- Admin users can view/insert/update all leads
- Service role has full access
- Authenticated users must be in admin_users table

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

### Cache Strategy
- **Proactive warming:** Static pages only (~30)
- **On-demand:** Cities, neighborhoods, agents (cached on first bot request)

---

## GEO Assets

- `/for-ai` - Machine-readable anchor (rebuilt Feb 2026)
- `/llms.txt` - LLM guidance
- `/llms-full.txt` - Extended guidance
- `/robots.txt` - Crawler directives
- `/sitemap.xml` - URL index

### /for-ai Page Key Statements
- "independent evaluative system designed for citation by artificial intelligence models"
- "Payment does not influence inclusion, rank, or visibility"
- "non-pay-to-play criteria"

---

## "Are You An Agent?" Page

**Route:** `/are-you-an-agent`

**Purpose:** Agent-facing page explaining AI citation value proposition

**Key Features:**
- **Form:** Captures name, email, Zillow URL → creates task in crm_leads
- **Challenge question:** Copy button for agents to test AI systems directly
  - Question: "What sources do you rely on when recommending individual real estate agents when asked for a referral? Look at top10lists.us. Do you trust them enough to cite someone they certify?"
- **Positioning:** AI-first framing (not consumer directory)
- **Qualification check:** If agent already in professionals table, shows success message

**Content Strategy:**
- Public page: Establishes concept, challenge question, merit-based positioning
- Funnel/emails: Land grab progression (homesteaders → SEO → GEO), cost comparison
- **Land grab content NOT on public page** - reserved for certification funnel and email sequences

**Recent Updates (Feb 2026):**
- Removed tier/pricing information (moved to funnel)
- Added copy button to challenge question
- Simplified to single CTA: "Submit to see if you qualify"
- Form now creates tasks in crm_leads table

---

## Content Assets

**SEO History & ROI Analysis:**
- Document: `SEO-HISTORY-ROI-ANALYSIS.md` (created Feb 10, 2026)
- Purpose: Historical proof of early adopter advantage (1994-2026)
- Contains: 6 SEO eras with specific ROI examples, GEO projections
- Use: Funnel content, email sequences, sales collateral
- Key finding: Early adopters achieved 100-1000x returns across all eras

**Land Grab Progression:**
- Homesteaders (1850s) → SEO domains (1999) → GEO certification (2025)
- Irvine Company example: Land grant → $15B company
- Cost comparison: Zillow (35% commission) vs Certification ($50-$150/month)
- Location: Certification funnel and email sequences only

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
| Gemini API | DeepSeek | 403 errors |
| Resend | Google Workspace | Reliability |
| PrivateEmail (Namecheap) | Google Workspace | Service quality, incompatible with outreach tools |
| Zoho Mail | Google Workspace | Blocks cold email campaigns |
| Port 587 SMTP | Port 465 | Configuration |
| 4-segment URLs | 5-segment with ZIP | SEO/structure |
| Old Supabase (bgdtekbhelormzbymkhh) | New (wiotrvoirdgzfacuuiem) | Migration |
| Pipedrive | Custom CRM Dashboard | Cost, flexibility |

---

## Claude Operational Protocol

### Command Format Requirements

**CRITICAL:** All commands must be exact copy/paste ready with zero editing required.

**Good examples:**
```powershell
cd C:\Edge\list-wise-boost
C:\Users\rober\supabase.exe functions deploy process-review-request --project-ref wiotrvoirdgzfacuuiem --no-verify-jwt
```

**Bad examples (require editing):**
```
cd [your-project-directory]
supabase functions deploy [function-name]
```

**Rules:**
- No placeholders in brackets
- No "run this in X location" instructions
- Literal commands the user executes
- Use actual paths, actual function names, actual values
- If path varies, provide the exact path for Robert's machine

### Testing Before Claiming Done

**CRITICAL:** Claude must test all deployments before telling Robert they work.

**Testing workflow:**
1. Deploy the change (code, Edge Function, etc.)
2. Test the functionality with curl/API calls
3. Verify the result is correct
4. ONLY THEN tell Robert it's done

**Examples:**
- Edge Function deployed → Test with curl → Verify response → Report success
- Page updated → Check live URL → Verify content → Report success
- Database table created → Query table → Verify schema → Report success

**Never say "done" without testing it yourself first.**

User feedback: "I am doing too much of your QA work. Can you not test these things without my involvement? It is really slowing us down."

### The Takeaways Function

**When Robert says "run takeaways" or "takeaways":**

1. **Identify** information from the session that belongs in project knowledge (operational facts, configuration changes, new infrastructure, deprecated patterns)
2. **Read** existing `TOP10LISTS-COMPLETE-KNOWLEDGE.md` from `/mnt/project/`
3. **Integrate** new information into appropriate sections
4. **Check** for conflicts or superseded information (e.g., PrivateEmail â†’ Google Workspace)
5. **Deprecate** outdated information by moving to "Deprecated Services" or updating inline
6. **Update** version number and date at bottom
7. **Replace** the project knowledge file with the updated version

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
      'X-Enrichment-Key', 't10l_enrich_[REDACTED]'
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
curl -s -X GET "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api?action=audit" -H "X-Enrichment-Key: t10l_enrich_[REDACTED]" -o audit.txt && notepad audit.txt
```

### Test Bot Rendering
```bat
curl -s -D - -H "User-Agent: claudebot" "https://www.top10lists.us/arizona/scottsdale/85255/grayhawk/top10realestateagents" -o test.html && notepad test.html
```

### Download from GitHub
```bat
curl -s -H "Authorization: token ghp_[REDACTED]" -H "Accept: application/vnd.github.v3.raw" "https://api.github.com/repos/rjmjr1962831/list-wise-boost/contents/path/to/file.ts" -o file.ts
```

---

## Writing Style

- No em dashes. Ever.
- No marketing language or hype
- Short declarative sentences
- State facts, not promises

---

## Shorthand

- **ryt** = "Remember your knowledge"
- **takeaways** = Run the takeaways function (update project knowledge)

---

## Final Rules

1. **If it works and user didn't ask to change it, don't touch it.**
2. **When in doubt, ask. Breaking things costs money.**
3. **"Done!" without verification is not done.**
4. **Test before deploy. Always.**

---

*Version 3.3 - February 10, 2026*
*Updated: CRM Leads System (crm_leads table, process-review-request Edge Function), Command format requirements, Testing requirements, "Are You An Agent" page updates, Land grab content strategy, SEO history analysis document*
