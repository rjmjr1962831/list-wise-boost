# Cloudflare Logpull Setup Guide

This guide explains how to use Cloudflare Logpull to fetch HTTP request logs for bot analytics. Use Logpull when Logpush is not available (e.g. plan restrictions).

## Overview

**Logpull** = you pull logs from Cloudflare's API (vs **Logpush** = Cloudflare pushes to your endpoint).

The `cloudflare-logpull` Supabase Edge Function:
- Calls Cloudflare's `GET /zones/{zone_id}/logs/received` API
- Fetches raw HTTP request logs (with User-Agent, path, cache status, etc.)
- Inserts into `cloudflare_request_logs` with bot detection
- Skips duplicates (same `ray_id` from Worker's `log-bot-visit`)

## Prerequisites

- Cloudflare zone with Logpull access (Enterprise, or Pro/Business with Logpull enabled)
- API token with **Account** → Logs → **Read** permission (see [create-logpull-token.md](./create-logpull-token.md))
- Supabase project with Edge Functions

## Step 1: Create API Token

Follow [create-logpull-token.md](./create-logpull-token.md) to create a token with Account-level Logs Read permission.

## Step 2: Set Supabase Secrets

```bash
npx supabase secrets set CLOUDFLARE_ZONE_ID=your_zone_id --project-ref wiotrvoirdgzfacuuiem
npx supabase secrets set CLOUDFLARE_API_TOKEN=your_token --project-ref wiotrvoirdgzfacuuiem
```

Or via dashboard: Supabase → Project Settings → Edge Functions → Secrets.

## Step 3: Deploy the Function

```bash
cd C:\Repository\list-wise-boost
npx supabase functions deploy cloudflare-logpull --project-ref wiotrvoirdgzfacuuiem
```

## Step 4: Schedule the Function

The function fetches the **last hour** of logs each run. Schedule it to run every hour:

### Option A: Supabase pg_cron (if available)

```sql
SELECT cron.schedule(
  'cloudflare-logpull-hourly',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/cloudflare-logpull',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

### Option B: GitHub Actions or external cron

```yaml
# .github/workflows/logpull.yml
on:
  schedule:
    - cron: '5 * * * *'  # Every hour at :05
jobs:
  logpull:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/cloudflare-logpull" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
```

### Option C: Manual test

```bash
curl -X POST "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/cloudflare-logpull" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## Step 5: Verify

1. Run the function manually
2. Check Supabase: `SELECT COUNT(*) FROM cloudflare_request_logs WHERE timestamp > NOW() - INTERVAL '2 hours';`
3. Check function logs: `npx supabase functions logs cloudflare-logpull --project-ref wiotrvoirdgzfacuuiem`

## API Limits

- **Time range**: Max 1 hour per request
- **End time**: Must be at least 5 minutes ago
- **Retention**: Logs kept 3–7 days (Cloudflare)

Each run fetches `(now - 66 min)` to `(now - 6 min)`. Running hourly captures all traffic.

## Dual-Source: Logpull + Worker

Bot crawl data comes from **two sources**:

1. **log-bot-visit** (Worker) – Called by the Cloudflare Worker for each bot request. Adds `agent_id`, `list_page_type`, `agents_shown`.
2. **cloudflare-logpull** – Pulls raw HTTP logs from Cloudflare API. Captures **all** requests that hit the zone, including any the Worker might miss.

**Deduplication:** Both use `ray_id`. The Worker usually inserts first; Logpull runs hourly and skips duplicates via `ON CONFLICT (ray_id) DO NOTHING`.

## Troubleshooting

### 403 Forbidden
- Token needs **Account**-level Logs Read, not Zone-level
- See [create-logpull-token.md](./create-logpull-token.md)

### No logs returned
- Logpull may be Enterprise-only on some plans
- Check Cloudflare Dashboard → Analytics & Logs for your plan's capabilities

### Duplicate ray_id errors
- Use `upsert` with `ignoreDuplicates: true` (already in place)
- Ensures we don't duplicate when Worker and Logpull both see the same request
