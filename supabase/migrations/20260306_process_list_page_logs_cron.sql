-- Run process-list-page-logs every 10 minutes so list-page rows get per-agent rows and summary updates.
DO $$
BEGIN
  PERFORM cron.unschedule('process-list-page-logs');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'process-list-page-logs',
  '*/10 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/process-list-page-logs',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);
