-- Run in Supabase Dashboard → SQL Editor to schedule hourly badge-issue job.
-- Optional: replace X-Enrichment-Key value with the UPDATER secret.
SELECT cron.unschedule('badge-issue-on-tier-change');

SELECT cron.schedule(
  'badge-issue-on-tier-change',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/badge-issue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Enrichment-Key', 't10l_enrich_0448c4870d72ed90fd43171123fd0e44558f019a2b5807d1b297604dad6b235a'
    ),
    body := '{}'::jsonb
  );
  $$
);
