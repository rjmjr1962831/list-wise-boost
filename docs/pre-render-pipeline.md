# Pre-Render Pipeline for Static City and Neighborhood Pages

## Overview

Pipeline that pre-renders full static HTML for every city and neighborhood list page, stores it in Cloudflare KV, and serves it to bots. Humans continue to get the React SPA.

## Components

1. **pre-render-page** (Supabase Edge Function) – Generates complete static HTML for one city or one neighborhood. Input: `type`, `state_slug`, `city_slug`, optional `neighborhood_slug`. Auth: `X-Enrichment-Key`. Returns `{ html, metadata }`.

2. **PRERENDER_CACHE** (Cloudflare KV) – Namespace that stores gzipped HTML. Key format: `clean/{state_slug}/{city_slug}` (city) or `clean/{state_slug}/{city_slug}/{neighborhood_slug}` (neighborhood).

3. **Worker** – For bot requests to list URLs, checks KV first. If hit, returns gzipped HTML with `X-Prerender: kv-cache`. Also exposes `POST /__prerender-store` (X-Warm-Secret) to write key + html; Worker gzips and stores in KV.

4. **pre-render-batch** (Supabase Edge Function) – Iterates cities/neighborhoods, calls pre-render-page for each, then POSTs to Worker `__prerender-store`. Env: `WORKER_STORE_URL`, `WARM_SECRET`.

5. **Cron** – `20260219_nightly_prerender_cron.sql` schedules `pre-render-batch` at 10:00 UTC (3:00 AM MST) daily.

## Execution Order

1. Create KV namespace `PRERENDER_CACHE` in Cloudflare dashboard and bind it to the Worker.
2. Deploy Worker (includes pathToKvKey, KV read, and `__prerender-store`).
3. Deploy Edge Functions: `pre-render-page`, `pre-render-batch`.
4. Set Edge Function secrets: `WARM_SECRET`, and for batch `WORKER_STORE_URL` (e.g. `https://www.top10lists.us/__prerender-store`) if not default.
5. Run migration for nightly cron (if using pg_cron).
6. Trigger a batch (e.g. dry run): `POST .../pre-render-batch` with `{"scope":"state","state_slug":"arizona","type":"city","concurrency":5,"dry_run":true}`.
7. Verify: `curl -A "Googlebot" https://www.top10lists.us/arizona/phoenix/top10realestateagents` and check for `X-Prerender: kv-cache` once KV is populated.

## KV Setup (Cloudflare)

1. Workers & Pages > KV > Create namespace > Name: `PRERENDER_CACHE`.
2. Workers > your Worker > Settings > Variables and Secrets > KV Namespace Bindings > Add binding: Variable name `PRERENDER_CACHE`, KV namespace `PRERENDER_CACHE`.

## What only Robert needs to do

- **Set `WARM_SECRET`** in Supabase: Dashboard → Project Settings → Edge Functions → Secrets, or:  
  `npx supabase secrets set WARM_SECRET=<your-secret>`  
  (pre-render-batch uses this to POST to the Worker’s `__prerender-store`.)
- **Apply the nightly cron migration** in production if your policy requires a human to run SQL: run the SQL in `supabase/migrations/20260219_nightly_prerender_cron.sql` in the Supabase SQL editor.

Everything else (Worker deploy, Edge Function deploys, KV binding, testing pre-render-page) can be done by the assistant.

## Validation (in pre-render-page)

Before returning HTML we validate: length > 5000, h1 contains expected name, agent count matches, schema numberOfItems, no CJK characters, no `<UNKNOWN>` placeholders.
