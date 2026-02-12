-- Cron job to ensure selection_rationale enrichment continues
-- Runs every 2 minutes as safety net if self-chaining fails

SELECT cron.schedule(
  'enrich-selection-rationale-cron',
  '*/2 * * * *',  -- Every 2 minutes
  $$
  SELECT net.http_post(
    url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrich-selection-rationale',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Enrichment-Key', 't10l_enrich_0448c4870d72ed90fd43171123fd0e44558f019a2b5807d1b297604dad6b235a'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To check cron status:
-- SELECT * FROM cron.job WHERE jobname = 'enrich-selection-rationale-cron';

-- To unschedule when complete:
-- SELECT cron.unschedule('enrich-selection-rationale-cron');
