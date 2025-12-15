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
    E'SELECT net.http_post(url:=\'https://bgdtekbhelormzbymkhh.supabase.co/functions/v1/warm-cache\', headers:=\'{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZHRla2JoZWxvcm16Ynlta2hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MjMxOTEsImV4cCI6MjA3ODA5OTE5MX0.pCRa4kAOE2tKzs7JNkoPtfT24sq-50KG7Eopz1-8oCk"}\'::jsonb, body:=\'{}\'::jsonb) AS request_id;'
  );
END;
$function$