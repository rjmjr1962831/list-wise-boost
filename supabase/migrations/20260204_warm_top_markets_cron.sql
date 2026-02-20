-- =====================================================
-- AUTOMATIC CACHE WARMING FOR TOP 25% MARKETS
-- Runs every 6 hours to keep hot markets cached
-- =====================================================

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove old job if it exists
SELECT cron.unschedule('warm-top-markets-cache') WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'warm-top-markets-cache');

-- Create new cron job to warm top 25% of markets every 6 hours
-- Runs at: 12am, 6am, 12pm, 6pm daily
SELECT cron.schedule(
  'warm-top-markets-cache',
  '0 */6 * * *',  -- Every 6 hours
  $$
  SELECT net.http_post(
    url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/warm-top-markets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.service_role_key', true), '')
    ),
    body := jsonb_build_object(
      'topPercentage', 0.25,
      'concurrency', 10
    )
  );
  $$
);

-- Log the setup
DO $$
BEGIN
  RAISE NOTICE 'Cache warming cron job created: runs every 6 hours';
  RAISE NOTICE 'Target: Top 25%% of neighborhoods in Arizona and California';
  RAISE NOTICE 'Schedule: 12am, 6am, 12pm, 6pm daily';
END $$;

-- View active cron jobs
SELECT * FROM cron.job WHERE jobname = 'warm-top-markets-cache';
