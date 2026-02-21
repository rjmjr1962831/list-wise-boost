-- Nightly pre-render of city and neighborhood pages to Cloudflare KV.
-- Runs at 10:00 UTC (3:00 AM MST). Calls pre-render-batch with scope=all, type=all.

SELECT cron.unschedule('nightly-prerender');

SELECT cron.schedule(
  'nightly-prerender',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/pre-render-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Enrichment-Key', 't10l_enrich_0448c4870d72ed90fd43171123fd0e44558f019a2b5807d1b297604dad6b235a'
    ),
    body := '{"scope":"all","type":"all","concurrency":5}'::jsonb
  );
  $$
);

-- Runs 10:00 UTC = 3:00 AM MST. Pre-renders all city and neighborhood pages to KV.
