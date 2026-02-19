-- warm-cache cron: calls wiotrvoirdgzfacuuiem warm-cache every 10 min.
-- Uses app.settings.service_role_key (set in DB or vault) so no key is stored in code.
CREATE OR REPLACE FUNCTION public.start_warm_cache_cron()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  BEGIN
    PERFORM cron.unschedule('warm-cache-continuous');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  PERFORM cron.schedule(
    'warm-cache-continuous',
    '*/10 * * * *',
    $cmd$
    SELECT net.http_post(
      url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/warm-cache',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.service_role_key', true), '')
      ),
      body := '{}'::jsonb
    );
    $cmd$
  );
END;
$function$