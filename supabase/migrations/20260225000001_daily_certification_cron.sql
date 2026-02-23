-- Daily certification update: run at midnight MST (07:00 UTC).
-- Calls daily-certification-update edge function; it finds agents due by cadence (daily, every two weeks, monthly, annual),
-- runs memo23 enrichment for each, updates DB with new data, and sets certification_updated_at.

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

-- 07:00 UTC = midnight MST (Arizona no DST). Processes up to 100 due agents per run; sets certification_updated_at for each.
