-- Run in Supabase SQL Editor to start the sequence-processor immediately (every 5 min).
-- Uses the same logic as resume_sequence_processor_at_0500(): Vault secret 'service_role_key' for Bearer auth.
-- After this, sequence-processor runs every 5 min until you run emergency stop (20260307000001).

SELECT cron.unschedule('sequence-processor')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sequence-processor');

SELECT cron.schedule(
  'sequence-processor',
  '*/5 * * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/sequence-processor',
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
