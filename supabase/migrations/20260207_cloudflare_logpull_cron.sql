-- Schedule Cloudflare Logpull to run every hour
-- Pulls HTTP request logs from Cloudflare and stores them for bot analytics

-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the cron job (runs every hour at :05)
SELECT cron.schedule(
  'cloudflare-logpull-hourly',
  '5 * * * *', -- Every hour at 5 minutes past
  $$
  SELECT
    net.http_post(
      url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/cloudflare-logpull',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- View scheduled jobs
SELECT * FROM cron.job WHERE jobname = 'cloudflare-logpull-hourly';

COMMENT ON EXTENSION pg_cron IS 'Cloudflare Logpull runs hourly to fetch and analyze bot traffic';
