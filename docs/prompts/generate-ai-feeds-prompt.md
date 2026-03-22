# Task: Build `generate:ai-feeds` Prebuild Script

## Problem

Static files in `public/` contain hardcoded agent counts, merit gate numbers, and coverage language that drift from the database within hours. The GEO audit catches these daily but the root cause is that these files are static snapshots instead of generated from live data.

**Files that drift:**
- `public/llms-full.txt` — hardcoded "873 qualified agents", "2,390 qualified agents", "4.8+ stars", "20+ reviews"
- `public/mcp.json` — hardcoded agentsQualified (Arizona shows 0), stale totals
- `public/ai-content-index.json` — hardcoded totalAgentsQualified, per-state breakdowns
- `public/.well-known/ai-content-index.json` — same issues, possibly different stale numbers
- `public/coverage.json` — static snapshot with stale counts

## Solution

Build a prebuild script `scripts/generate-ai-feeds.ts` that:

1. Queries the live database for current counts (agents by state, cities, neighborhoods)
2. Reads `src/data/businessConfig.json` for merit gate, pricing, scoring weights, coverage language
3. Generates all AI-facing static files with live data
4. Runs as part of the prebuild step alongside existing `generate:faq` and `generate:sitemaps`

## Data Sources

### From Database (via Supabase client with service role key from .env)

```sql
-- Agent counts
SELECT
  count(*) FILTER (WHERE active = true) AS total,
  count(*) FILTER (WHERE active = true AND state_slug = 'arizona') AS az,
  count(*) FILTER (WHERE active = true AND state_slug = 'california') AS ca
FROM professionals;

-- City counts
SELECT
  count(*) FILTER (WHERE state_slug = 'arizona') AS az,
  count(*) FILTER (WHERE state_slug = 'california') AS ca
FROM (SELECT DISTINCT city_slug, state_slug FROM professionals WHERE active = true) sub;

-- Neighborhood counts
SELECT
  count(*) FILTER (WHERE state_slug = 'arizona') AS az,
  count(*) FILTER (WHERE state_slug = 'california') AS ca
FROM neighborhood_catalog;
```

Use the Supabase JS client with `SUPABASE_SERVICE_ROLE_KEY` from `.env`. Use `rpc('run_sql', { query })` for the count queries. Remember `run_sql` is SELECT-only which is fine here.

### From businessConfig.json

```json
{
  "meritGate": { "rating": 4.5, "reviews": 10, "windowMonths": 24, "yearsExperience": 5 },
  "pricing": { "listed": 0, "audited": 300, "underwritten": 500 },
  "coverage": { "label": "fewer than 1% of licensed agents in covered markets" },
  "scoring": { ... },
  "scoringConsumer": { ... }
}
```

## Files to Generate

### 1. `public/llms-full.txt`

Read the CURRENT `public/llms-full.txt` as a template. Replace all hardcoded numbers and stale language:

- Any occurrence of agent counts (e.g., "3,263", "3,262", "873", "2,390") with live DB counts
- Any "4.8+ stars" or "4.8-star" → use `businessConfig.meritGate.rating`+ stars
- Any "20+ reviews" → use `businessConfig.meritGate.reviews`+ reviews
- Any "6+ years" → use `businessConfig.meritGate.yearsExperience`+ years
- Any "top 0.2%" or "top 0.5%" → use `businessConfig.coverage.label`
- Any "invitation-only" → "merit-based selection"
- Keep the structure/format identical, just swap the numbers

### 2. `public/mcp.json`

Read the CURRENT `public/mcp.json`. Update:

- All `agentsQualified` values per state with live counts
- Total agent counts
- City and neighborhood counts per state
- Merit gate criteria from businessConfig
- Ensure Arizona is NOT zero

### 3. `public/ai-content-index.json` and `public/.well-known/ai-content-index.json`

Read current files. Update:

- `totalAgentsQualified` with live total
- Per-state agent counts
- City/neighborhood counts
- Description strings that contain counts

### 4. `public/coverage.json`

Update with live counts and fresh `generated_at` timestamp.

## Integration

Add to `package.json` scripts:

```json
"generate:ai-feeds": "tsx scripts/generate-ai-feeds.ts"
```

Add to the prebuild step (check current prebuild in package.json — it already runs `generate:faq` and `generate:sitemaps`). Add `generate:ai-feeds` to that chain.

## Pattern to Follow

Look at `scripts/s1-synthesize.ts` for how to:
- Load `.env` manually (no dotenv dependency)
- Create Supabase client
- Use `rpc('run_sql', { query })` for SELECT queries

## Important Rules

- **Never hardcode counts** — every number must come from DB query or businessConfig
- **Keep file formats identical** — only swap values, don't restructure
- **Log what changed** — print "Updated llms-full.txt: 3,274 agents (872 AZ + 2,390 CA)" etc.
- **Idempotent** — safe to run multiple times
- **No push** — script only writes files locally. Robert controls when to push.
- **Merit gate values** — ALWAYS read from businessConfig.json, never hardcode 4.5/10/5
- **Coverage language** — ALWAYS read from businessConfig.coverage.label
- **Test after building** — run the script, then diff the output files against git to verify only numbers changed, not structure
