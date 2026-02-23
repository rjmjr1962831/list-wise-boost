-- Run in Supabase Dashboard → SQL Editor to schedule midnight MST job.
-- Optional: replace X-Enrichment-Key value with the UPDATER secret (Dashboard → Project Settings → Edge Functions → Secrets).
SELECT cron.unschedule('daily-certification-update');

SELECT cron.schedule(
  'daily-certification-update',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/daily-certification-update',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Enrichment-Key', 't10l_enrich_0448c4870d72ed90fd43171123fd0e44558f019a2b5807d1b297604dad6b235a'
    ),
    body := '{}'::jsonb
  );
  $$
);
