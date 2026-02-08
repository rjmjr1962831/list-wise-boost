# Cloudflare Logpush Setup Guide

This guide explains how to configure Cloudflare to push HTTP request logs to Supabase for bot analytics.

## Overview

Cloudflare Logpush sends batches of request logs to your Supabase Edge Function, which stores them for analysis. This allows you to track which bots are crawling your site and which agent profiles they're viewing.

## Prerequisites

- Cloudflare Pro, Business, or Enterprise plan (or Workers Paid plan for Logpush)
- Supabase project with Edge Functions deployed

## Step 1: Deploy the Edge Function

```bash
cd C:\Repository\list-wise-boost
npx supabase functions deploy cloudflare-logpush --project-ref wiotrvoirdgzfacuuiem
```

You'll get a URL like:
```
https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/cloudflare-logpush
```

## Step 2: Create Migration

Run the SQL migration to create the logs table:

```bash
# Connect to Supabase SQL Editor and run:
# supabase/migrations/20260207_cloudflare_logs.sql
```

Or via Supabase CLI:
```bash
npx supabase db push --project-ref wiotrvoirdgzfacuuiem
```

## Step 3: Configure Cloudflare Logpush

### Option A: Via Cloudflare Dashboard

1. Go to **Cloudflare Dashboard** → Select your domain (`top10lists.us`)
2. Navigate to **Analytics & Logs** → **Logs** → **Logpush**
3. Click **"Add Logpush job"**
4. Configure:
   - **Dataset**: HTTP requests
   - **Destination**: HTTP endpoint
   - **URL**: `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/cloudflare-logpush`
   - **Authentication**: None (or add Bearer token if desired)
   - **Frequency**: Every minute (or as desired)
   - **Fields**: Select these at minimum:
     - `ClientIP`
     - `ClientRequestUserAgent`
     - `ClientRequestURI`
     - `ClientRequestHost`
     - `ClientRequestMethod`
     - `EdgeStartTimestamp`
     - `RayID`
     - `ClientCountry`
     - `CacheResponseStatus`
     - `EdgeResponseStatus`

5. Save the job

### Option B: Via Cloudflare API

```bash
# Set your Cloudflare credentials
CLOUDFLARE_ZONE_ID="your_zone_id"
CLOUDFLARE_API_TOKEN="your_api_token"
SUPABASE_ENDPOINT="https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/cloudflare-logpush"

# Create Logpush job
curl -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/logpush/jobs" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "top10lists-bot-analytics",
    "destination_conf": "'"$SUPABASE_ENDPOINT"'",
    "dataset": "http_requests",
    "frequency": "high",
    "enabled": true,
    "logpull_options": "fields=ClientIP,ClientRequestUserAgent,ClientRequestURI,ClientRequestHost,ClientRequestMethod,EdgeStartTimestamp,RayID,ClientCountry,CacheResponseStatus,EdgeResponseStatus&timestamps=rfc3339"
  }'
```

## Step 4: Test the Integration

1. Wait a few minutes for logs to accumulate
2. Check Supabase logs table:

```sql
SELECT 
  bot_type, 
  COUNT(*) as visits,
  COUNT(DISTINCT path) as unique_pages
FROM cloudflare_request_logs
WHERE is_bot = true
  AND timestamp > NOW() - INTERVAL '1 hour'
GROUP BY bot_type
ORDER BY visits DESC;
```

## Step 5: Run Analytics

Use the analysis script to generate reports:

```bash
# Analyze last 7 days
npx tsx scripts/analyze-bot-crawls.ts

# Analyze last 30 days
npx tsx scripts/analyze-bot-crawls.ts --days=30
```

## Monitoring

### Check Edge Function Logs
```bash
npx supabase functions logs cloudflare-logpush --project-ref wiotrvoirdgzfacuuiem
```

### Verify Logpush Status
In Cloudflare Dashboard → Analytics & Logs → Logpush, you should see:
- ✅ Status: Active
- Recent deliveries shown
- Success rate > 95%

## Troubleshooting

### No logs appearing?
1. Check Edge Function is deployed: `npx supabase functions list`
2. Check Cloudflare Logpush job status in dashboard
3. Check Edge Function logs for errors
4. Verify table exists: `SELECT * FROM cloudflare_request_logs LIMIT 1;`

### High error rate?
1. Check Supabase Edge Function logs
2. Verify table schema matches
3. Check for rate limiting issues

### Duplicate logs?
The `ray_id` unique constraint prevents duplicates. This is normal and expected.

## Cost Considerations

- **Cloudflare Logpush**: Included in Pro/Business/Enterprise or Workers Paid ($5/mo)
- **Supabase**: Storage for logs (estimate ~1KB per log entry)
- **Edge Function**: Invocations (Cloudflare batches requests, so low invocation count)

## Data Retention

By default, logs are kept forever. To manage storage:

```sql
-- Delete logs older than 90 days
DELETE FROM cloudflare_request_logs
WHERE timestamp < NOW() - INTERVAL '90 days';

-- Or create a scheduled job in Supabase
```

## Example Queries

### Top bot visitors
```sql
SELECT 
  bot_type,
  COUNT(*) as visits,
  COUNT(DISTINCT DATE(timestamp)) as days_active,
  MAX(timestamp) as last_seen
FROM cloudflare_request_logs
WHERE is_bot = true
GROUP BY bot_type
ORDER BY visits DESC;
```

### Bot cache performance
```sql
SELECT 
  bot_type,
  cache_status,
  COUNT(*) as requests,
  AVG(cache_response_status) as avg_response_time
FROM cloudflare_request_logs
WHERE is_bot = true
  AND cache_status IN ('HIT', 'MISS')
GROUP BY bot_type, cache_status
ORDER BY bot_type, requests DESC;
```

### Most crawled agent pages
```sql
SELECT 
  path,
  COUNT(*) as bot_visits,
  COUNT(DISTINCT bot_type) as unique_bots,
  ARRAY_AGG(DISTINCT bot_type) as bots
FROM cloudflare_request_logs
WHERE is_bot = true
  AND path LIKE '%/top10realestateagents%'
GROUP BY path
ORDER BY bot_visits DESC
LIMIT 50;
```
