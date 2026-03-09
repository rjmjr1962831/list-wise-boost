-- Register sequencer-v2-tick cron (every 2 minutes)
SELECT cron.schedule(
  'sequencer-v2-tick',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/sequencer-v2-tick',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Remove old sequence-processor cron if it exists
DO $$
BEGIN
  PERFORM cron.unschedule('sequence-processor-cron');
EXCEPTION WHEN OTHERS THEN
  -- job doesn't exist, ignore
END;
$$;
