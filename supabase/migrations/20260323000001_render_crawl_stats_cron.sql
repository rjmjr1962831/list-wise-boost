-- Daily pre-render of crawl-stats page at 05:30 UTC (after rollup at 04:00/05:00)
SELECT cron.schedule(
  'render-crawl-stats-daily',
  '30 5 * * *',
  $$SELECT net.http_post(
    url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/render-crawl-stats',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )$$
);
