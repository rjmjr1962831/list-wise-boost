-- pg_cron jobs for health-monitor (every 4 hours) and geo-audit-daily (6am MST = 13:00 UTC)

-- Health monitor: every 4 hours
SELECT cron.schedule(
  'health-monitor-4h',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/health-monitor',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- GEO audit: daily at 13:00 UTC (6:00 AM MST)
SELECT cron.schedule(
  'geo-audit-daily-6am',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/geo-audit-daily',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
