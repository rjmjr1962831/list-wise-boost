-- Unschedule the Cloudflare logpull cron job (Cloudflare is deprecated per SSoT)
SELECT cron.unschedule('cloudflare-logpull-hourly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cloudflare-logpull-hourly');

-- Also create a temporary view to list all active cron jobs
CREATE OR REPLACE FUNCTION public.list_cron_jobs()
RETURNS TABLE(jobid bigint, schedule text, active boolean, jobname text, command text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jobid, schedule, active, jobname, command FROM cron.job ORDER BY jobid;
$$;
