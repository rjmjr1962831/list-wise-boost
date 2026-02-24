# Arizona 0-Agent Geo Misfire: Diagnosis & Fix

## Problem

Many Arizona cities and neighborhoods in the catalog have **0 qualified agents**. When users or bots search for these locations or land on them via links/sitemaps, they get empty list pages ("geo misfire") — bad UX and wasted crawl.

## Root causes

1. **search_location RPC** returns *all* active Arizona cities and *all* active neighborhoods that match the term, with **no filter for "has at least one qualified agent"**. So search can suggest e.g. "Sedona" or "Prescott" and the user lands on a page with 0 agents.

2. **Sitemap** is already correct: it only includes cities/neighborhoods with ≥1 qualified agent (4.8+ stars, 20+ reviews), using `get_neighborhood_ids_with_qualified_agents` for neighborhoods. *But* if that RPC fails, generate-sitemap falls back to **all** neighborhoods, which can re-introduce 0-agent URLs.

3. **Data**: `cities` and `neighborhood_catalog` have many rows with `active`/`is_active = true` that have no (or no qualified) professionals.

## Solution (implemented)

### 1. Restrict search_location to "qualified" regions only

- **Cities**: Only return cities that have at least one active professional with `review_stars_rating >= 4.8` and `num_total_reviews >= 20` (same rule as sitemap).
- **Neighborhoods**: Only return neighborhoods that appear in `get_neighborhood_ids_with_qualified_agents()` (same rule as sitemap).

Effect: Search autocomplete and search results will no longer suggest cities/neighborhoods with 0 agents, so users don’t land on empty pages.

Migration: `supabase/migrations/20260227000000_search_location_qualified_only.sql`

### 2. Optional: Harden sitemap fallback

If `get_neighborhood_ids_with_qualified_agents` fails, avoid falling back to "all neighborhoods". Either:
- Omit neighborhoods from the sitemap for that run, or
- Retry the RPC once.

(Currently the code falls back to all neighborhoods on RPC failure.)

### 3. Visibility: List 0-agent Arizona areas

Script `scripts/report-arizona-zero-agent-geo.sql` (or run in SQL editor) lists Arizona cities and neighborhoods with 0 qualified agents so you can:
- Confirm the scope,
- Decide whether to deactivate them (`active` / `is_active = false`) or leave them for future expansion.

## Qualification rule (single source of truth)

- **Qualified agent**: `professionals.active = true`, `review_stars_rating >= 4.8`, `num_total_reviews >= 20`.
- **Qualified city**: at least one such professional with `city_id` = that city.
- **Qualified neighborhood**: at least one such professional with transaction activity in that neighborhood’s ZIPs (via `agent_zip_activity` + `neighborhood_catalog.zips`), implemented in `get_neighborhood_ids_with_qualified_agents()`.

## Files touched

| File | Change |
|------|--------|
| `supabase/migrations/20260227000000_search_location_qualified_only.sql` | `search_location` restricted to qualified cities and neighborhoods |
| `scripts/report-arizona-zero-agent-geo.sql` | Ad-hoc report: Arizona cities/neighborhoods with 0 qualified agents |
