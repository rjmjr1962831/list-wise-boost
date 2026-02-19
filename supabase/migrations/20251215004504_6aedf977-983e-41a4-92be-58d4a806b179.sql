CREATE OR REPLACE FUNCTION public.start_warm_cache_cron()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- First, remove any existing job with this name (ignore errors if doesn't exist)
  BEGIN
    PERFORM cron.unschedule('warm-cache-continuous');
  EXCEPTION WHEN OTHERS THEN
    -- Job doesn't exist, that's fine
    NULL;
  END;
  
  -- Schedule new job to run every 10 minutes
  PERFORM cron.schedule(
    'warm-cache-continuous',
    '*/10 * * * *',
    E'SELECT net.http_post(url:=\'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/warm-cache\', headers:=\'{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpb3Rydm9pcmRnemZhY3V1aWVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MTcwNzcsImV4cCI6MjA4NTM5MzA3N30.BZAli-r81llqnq9xStghKNqK8MnrSNQMOIqkkE09mwI"}\'::jsonb, body:=\'{}\'::jsonb) AS request_id;'
  );
END;
$function$