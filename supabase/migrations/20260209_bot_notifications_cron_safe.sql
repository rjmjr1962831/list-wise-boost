-- Unschedule existing job if it exists (ignore error if not found)
DO $$
BEGIN
  PERFORM cron.unschedule('send-daily-bot-notifications');
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Job doesn't exist, that's fine
END $$;

-- Schedule bot notification emails to run daily at 9 AM UTC (1 AM PST / 4 AM EST)
SELECT cron.schedule(
  'send-daily-bot-notifications',
  '0 9 * * *', -- Every day at 9:00 AM UTC
  $$
  SELECT
    net.http_post(
      url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/send-bot-notifications',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body := '{"frequency": "daily"}'::jsonb
    ) as request_id;
  $$
);

-- View scheduled jobs
SELECT * FROM cron.job WHERE jobname = 'send-daily-bot-notifications';

COMMENT ON EXTENSION pg_cron IS 'Daily bot notification emails run at 9 AM UTC to notify agents of AI bot visits';
