# Warm Top Markets - Automatic Cache Warming

Automatically warms the cache for the **top 25% of neighborhoods** in Arizona and California, ensuring bots always hit warm cache (<100ms) instead of cold renders (10s).

## How It Works

1. **Queries** `neighborhood_catalog` table for all AZ and CA neighborhoods
2. **Sorts** by `score` field (highest to lowest)
3. **Selects** top 25% of markets
4. **Warms** cache by making bot requests to each page
5. **Runs automatically** every 6 hours via pg_cron

## Manual Invocation

Test the function manually:

```bash
curl -X POST https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/warm-top-markets \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "topPercentage": 0.25,
    "concurrency": 10
  }'
```

## Parameters

- `topPercentage` (default: 0.25) - What percentage of top markets to warm (0.25 = 25%)
- `concurrency` (default: 5) - How many requests to make in parallel
- `staticOnly` (default: false) - Only warm static pages (/, /arizona, etc.)

## Schedule

The cron job runs **every 6 hours**:
- 12:00am (midnight)
- 6:00am
- 12:00pm (noon)
- 6:00pm

This ensures pages are warmed before peak bot crawling times (typically 2am-6am).

## Expected Results

With top 25% of ~2000 neighborhoods:
- **~500 pages** will be warmed
- Takes **~20-30 minutes** to complete
- Bot requests will be **<100ms** (instant)
- Cold cache avoided for high-value markets

## Monitoring

Check cron job status:

```sql
SELECT * FROM cron.job WHERE jobname = 'warm-top-markets-cache';
```

View job history:

```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'warm-top-markets-cache')
ORDER BY start_time DESC 
LIMIT 10;
```

## Scaling

As you add more states, update `TARGET_STATES` in `index.ts`:

```typescript
const TARGET_STATES = ["AZ", "Arizona", "CA", "California", "TX", "Texas"];
```

The top 25% will automatically adjust to include the best markets across all states.
