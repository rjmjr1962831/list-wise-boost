# Prompt: Fix serve-bot-list-html to filter agents by neighborhood

## Context

`serve-bot-list-html` is the Supabase edge function that serves clean-room HTML for city and neighborhood listing pages (bot-facing). It handles URLs like:

- City: `/california/los-angeles/top10realestateagents`
- Neighborhood: `/california/los-angeles/hollywood/top10realestateagents`

**Current bug**: When serving a neighborhood page, the function queries agents by `city_id` only (line ~249 of `supabase/functions/serve-bot-list-html/index.ts`). This means ALL agents in Los Angeles appear on the Hollywood page — even agents who don't serve Hollywood. This inflates what bots see and misrepresents agent coverage.

**The fix**: When a `neighborhoodSlug` is present in the URL, filter agents using the `served_neighborhoods` JSONB column on the `professionals` table instead of (or in addition to) `city_id`.

## Database schema you need to know

```sql
-- professionals table has:
--   served_neighborhoods JSONB DEFAULT '[]'  -- e.g., ["hollywood", "silver-lake", "encino"]
--   served_cities JSONB                      -- e.g., ["los-angeles"]
--   city_id UUID                             -- FK to cities table
--   active BOOLEAN

-- GIN index exists:
--   idx_professionals_served_neighborhoods ON professionals USING GIN (served_neighborhoods)

-- Containment query example:
--   WHERE served_neighborhoods @> '"hollywood"'::jsonb
```

The `served_neighborhoods` values are slugs matching `neighborhood_catalog.neighborhood_slug`.

## What to change

### 1. In `supabase/functions/serve-bot-list-html/index.ts`

Find the agent query (currently filters by `city_id`). When the parsed path has a `neighborhoodSlug`:

- **Primary query**: Filter agents where `served_neighborhoods @> to_jsonb(neighborhoodSlug)` AND `active = true` AND merit gate (4.5+ stars, 10+ reviews).
- **Fallback**: If the primary query returns fewer than 3 agents, fall back to the current city-level query (`city_id`). This prevents empty or near-empty neighborhood pages.
- **City pages** (no `neighborhoodSlug`): Keep the current behavior — query by `city_id`. No change needed.

The Supabase JS client syntax for JSONB containment is:
```typescript
.contains('served_neighborhoods', [neighborhoodSlug])
```
or use `.filter()` with the `@>` operator.

### 2. Deploy and verify

After editing:
```bash
npx supabase functions deploy serve-bot-list-html --no-verify-jwt
```

Then verify by loading a neighborhood page that you know has agents with `served_neighborhoods` set:
- Check: `https://www.top10lists.us/california/los-angeles/hollywood/top10realestateagents`
- Before: Shows all ~386 LA agents
- After: Should show only agents whose `served_neighborhoods` includes "hollywood" (~10-20 agents)
- Also verify a city page still works normally: `https://www.top10lists.us/california/los-angeles/top10realestateagents`

### 3. Purge Vercel cache

After deploying and verifying on staging:
```bash
npx vercel --prod --force
```
Or purge via Vercel dashboard: Settings → Data Cache → Purge All.

## Important constraints

- **Do NOT push to staging or main without Robert's express permission.** Dev on localhost only.
- **Do NOT change the merit gate** (4.5+ stars, 10+ reviews in 24 months, 5+ years). It must remain on all queries.
- **Do NOT change city page behavior.** Only neighborhood pages get the new filter.
- **The fallback to city-level is critical.** 273 agents (8%) have empty `served_neighborhoods` arrays. Without the fallback, some neighborhood pages could show very few agents.
- **Test by actually loading the page in a browser**, not just reading the code. Verify the agent count changed.
- Run `ryt` first to load the full project knowledge document.

## Files involved

- `supabase/functions/serve-bot-list-html/index.ts` — the main edge function to edit
- `supabase/functions/_shared/site-chrome.ts` — shared header/footer (don't change)

## Verification checklist

- [ ] Neighborhood page shows fewer agents than city page
- [ ] City page agent count unchanged
- [ ] Agents shown on neighborhood page actually have that neighborhood in their `served_neighborhoods`
- [ ] Pages with < 3 neighborhood-matched agents fall back to city-level
- [ ] Merit gate still applied (no agents below 4.5 stars or 10 reviews)
- [ ] No empty pages
