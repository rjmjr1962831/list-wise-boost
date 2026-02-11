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
- ~3,500 active professionals in AZ and CA (4.8+ rating AND 20+ reviews)
- ~14,000 neighborhoods
- 6 states: Arizona, California, Texas, Florida, New York, Colorado
- Top 0.5% of agents selected from 1.1M analyzed

**GEO Performance:** Scores 92-95/100 across major AI systems

**First Customer:** Eileen Taggart (Flagstaff)

### Database Status (Feb 11, 2026)
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
- Push secrets to GitHub (see Security section)

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
- **Anon/Publishable:** [STORED IN ENVIRONMENT - Ask Robert]
- **Service Role:** [STORED IN ENVIRONMENT - Ask Robert]

**Dashboard:** https://supabase.com/dashboard/project/wiotrvoirdgzfacuuiem

**Environment Variables (Vercel/Vite):**
- `VITE_SUPABASE_URL` = https://wiotrvoirdgzfacuuiem.supabase.co
- `VITE_SUPABASE_PUBLISHABLE_KEY` = [Get from Robert]

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

**Auth Header:** `X-Enrichment-Key: [STORED IN ENVIRONMENT - Ask Robert]`

### Key Actions
- `GET ?action=audit` - Row counts and samples
- `GET ?action=fetch-neighborhoods&limit=100&offset=0` - Paginated neighborhoods
- `POST ?action=bulk-update` - Bulk update professionals
- `POST ?action=query` - Custom queries with filters

**Note:** Public API actions `agents-search` and `markets` may return "Invalid action" if deployed enrichment-api is older than source. Redeploy with `supabase functions deploy enrichment-api` if needed.

---

## API Keys

### AI Services
| Service | Key | Use |
|---------|-----|-----|
| **Anthropic** | [STORED IN ENVIRONMENT - Ask Robert] | Prime/Luxury content |
| **DeepSeek** | [STORED IN ENVIRONMENT - Ask Robert] | Main tier (90% cheaper) |
| **OpenAI** | [STORED IN ENVIRONMENT - Ask Robert] | |
| **Perplexity** | [DEPRECATED - avoid] | DEPRECATED - avoid |
| **Gemini** | [STORED IN ENVIRONMENT - Ask Robert] | Back in play (new key Feb 2026) |

### Infrastructure
| Service | Key |
|---------|-----|
| **Exa.ai** | [STORED IN ENVIRONMENT - Ask Robert] |
| **GitHub Token** | [STORED IN ENVIRONMENT - Ask Robert] |
| **Vercel API** | [STORED IN ENVIRONMENT - Ask Robert] |
| **ProxyScrape** | [STORED IN ENVIRONMENT - Ask Robert] |

---

## GitHub Access

- **Repository:** rjmjr1962831/list-wise-boost
- **Token:** [STORED IN ENVIRONMENT - Ask Robert]
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

**DO NOT use Perplexity** - Deprecated for cost reasons.

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

**Pipedrive (Feb 2026):** All Pipedrive admin UI removed. No Pipedrive Sync tab, no Pipedrive components in AdminDashboard or CRM. Backend/db tables unchanged.

**Database Tables:**
- `admin_users` - Role-based access (superadmin, admin, viewer)
- `audit_log` - Action tracking

**Superadmin Account:**
- Email: robert@aryah.ai
- UUID: [STORED IN ENVIRONMENT - Ask Robert]
- Role: superadmin

**Routes:**
- `/admin/login` - Admin login
- `/admin` - CMS Admin (synthesis, license import, cache warming, etc.)
- `/crm` - CRM (Leads, Follow-ups, Overview)
- `/admin/crm/login` - New CRM login
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

### Cache Strategy
- **Proactive warming:** Static pages only (~30)
- **On-demand:** Cities, neighborhoods, agents (cached on first bot request)

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
- `/mcp.json` - MCP protocol discovery (placeholder, real server planned)
- `/ai-content-index.json` - Structured content index

### /for-ai Page Key Statements
- "independent evaluative system designed for citation by artificial intelligence models"
- "Payment does not influence inclusion, rank, or visibility"
- "non-pay-to-play criteria"

---

## API Connection Tests

**Script:** `npm run test:api` (runs `scripts/test-api-connections.ts`)

Tests: Supabase REST (professionals, cities), Enrichment API audit, Public API (agents-search, markets), Live site, Vercel badge route.

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
| Pipedrive | Custom CRM Dashboard | Cost, flexibility; admin UI removed Feb 2026 |
| MCP Server (planned) | Deprioritized | Scope not confirmed, artifacts discussion unresolved |

---

## Claude Operational Protocol

### The Update Function

**When Robert says "update" or "run update":**

1. **Fetch** latest from GitHub: https://raw.githubusercontent.com/rjmjr1962831/list-wise-boost/main/docs/PROJECT-KNOWLEDGE.md
2. **Identify** takeaways from the session (operational facts, config changes, new infrastructure)
3. **Merge** takeaways into appropriate sections
4. **Write** sanitized version (no secrets) to `docs/PROJECT-KNOWLEDGE.md`
5. **Bump** version and date at bottom

**Or run:** `npm run update` or `npx tsx scripts/update-project-knowledge.ts --takeaways "..."`

### Daily Takeaways & docs/takeaways/

- **Cron:** Runs daily at 20:00 MST via Supabase cron → Edge Function `takeaways` → writes to `daily_takeaways` table.
- **Sync:** Pull from DB into markdown files: `npm run takeaways:sync` → writes `docs/takeaways/YYYY-MM-DD.md`.
- **Source:** https://github.com/rjmjr1962831/list-wise-boost/blob/main/docs/
- **Deprecated:** `TOP10LISTS-COMPLETE-KNOWLEDGE.md` — use this file (PROJECT-KNOWLEDGE.md).

### The Takeaways Function

**When Robert says "run takeaways" or "takeaways":**

1. **Identify** information from the session that belongs in project knowledge (operational facts, configuration changes, new infrastructure, deprecated patterns)
2. **Read** existing `TOP10LISTS-COMPLETE-KNOWLEDGE-UPDATED.md` from `/mnt/project/`
3. **Integrate** new information into appropriate sections
4. **Check** for conflicts or superseded information (e.g., PrivateEmail to Google Workspace)
5. **Deprecate** outdated information by moving to "Deprecated Services" or updating inline
6. **Update** version number and date at bottom
7. **Output** the updated file to `/mnt/user-data/outputs/` for download (Robert updates Claude Project manually)
8. **Create sanitized version** (no secrets) and push to GitHub at `/docs/PROJECT-KNOWLEDGE.md`

**Do NOT:**
- Write a summary in chat (that's not takeaways)
- Include educational content (like SEO history) unless it's operational
- Add information that belongs in separate project documentation (like TVPR)
- Include temporary troubleshooting steps or unresolved issues
- Push secrets to GitHub

**Include:**
- New configuration values (structure/format only, not actual keys)
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
      'X-Enrichment-Key', '[GET FROM ROBERT]'
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

## Security

### NEVER Commit Secrets to GitHub

**Protected files that must NOT be pushed to GitHub:**
- Any file containing API keys
- Environment files with credentials (`.env` is in .gitignore)
- Full project knowledge with secrets (use sanitized version only)

**What CAN be pushed:**
- Sanitized documentation at `/docs/PROJECT-KNOWLEDGE.md`
- Code files (secrets should be in environment variables)
- Configuration templates (with placeholder values)

**If you need to reference credentials in documentation:**
- Use placeholders: `[STORED IN ENVIRONMENT - Ask Robert]`
- Never include actual keys, tokens, or passwords
- Document the environment variable name, not the value

---

## Quick Reference Commands

### Update Project Knowledge
```bash
npm run update
```

### Test API Connections
```bash
npm run test:api
```

### Test Enrichment API
```bat
curl -s -X GET "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api?action=audit" -H "X-Enrichment-Key: [GET FROM ROBERT]" -o audit.txt && notepad audit.txt
```

### Test Bot Rendering
```bat
curl -s -D - -H "User-Agent: claudebot" "https://www.top10lists.us/arizona/scottsdale/85255/grayhawk/top10realestateagents" -o test.html && notepad test.html
```

### Download from GitHub
```bat
curl -s -H "Authorization: token [GET FROM ROBERT]" -H "Accept: application/vnd.github.v3.raw" "https://api.github.com/repos/rjmjr1962831/list-wise-boost/contents/path/to/file.ts" -o file.ts
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
- **update** = Fetch latest PROJECT-KNOWLEDGE.md from GitHub, merge session takeaways, write new version

---

## Final Rules

1. **If it works and user didn't ask to change it, don't touch it.**
2. **When in doubt, ask. Breaking things costs money.**
3. **"Done!" without verification is not done.**
4. **Test before deploy. Always.**
5. **Never push secrets to GitHub.**

---

*Version 3.7 - February 11, 2026*
*Updated: Update function added, Pipedrive admin UI removed, API test script, .env in gitignore*
