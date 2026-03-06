-- Schedule campaign-life-lock every 5 minutes (same Vault Bearer pattern as sequence-processor).
-- Bearer token: Vault secret 'service_role_key'. One-time setup: SELECT vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');
-- Do not apply until ready to run the campaign.

SELECT cron.unschedule('campaign-life-lock')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'campaign-life-lock');

SELECT cron.schedule(
  'campaign-life-lock',
  '*/5 * * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/campaign-life-lock',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
        current_setting('app.settings.service_role_key', true),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $cmd$
);
