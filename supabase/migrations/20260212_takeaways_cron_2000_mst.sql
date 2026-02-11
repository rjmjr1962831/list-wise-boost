-- Update daily takeaways cron from 17:00 to 20:00 MST
-- 20:00 MST = 03:00 UTC next day
-- DEPRECATED: 17:00 MST (0 0 * * *)

SELECT cron.unschedule('daily-takeaways-report');

SELECT cron.schedule(
  'daily-takeaways-report',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/takeaways',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

COMMENT ON TABLE public.daily_takeaways IS 'Daily takeaways reports. Cron at 20:00 MST creates slot. Output: docs/takeaways/';
