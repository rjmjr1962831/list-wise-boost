-- Daily takeaways table for project memory reports
-- Cron runs at 20:00 MST (03:00 UTC) - see 20260212_takeaways_cron_2000_mst.sql

CREATE TABLE IF NOT EXISTS public.daily_takeaways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL UNIQUE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_takeaways ENABLE ROW LEVEL SECURITY;

-- Only service role can manage (cron + admin)
CREATE POLICY "Service role full access on daily_takeaways"
  ON public.daily_takeaways
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Allow admins to read
CREATE POLICY "Admins can read daily_takeaways"
  ON public.daily_takeaways
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('admin', 'superadmin')
    )
  );

COMMENT ON TABLE public.daily_takeaways IS 'Daily takeaways reports. Cron at 20:00 MST. Output synced to docs/takeaways/.';

-- Cron: 17:00 MST = 0 0 UTC (DEPRECATED - updated to 20:00 MST in next migration)
SELECT cron.schedule(
  'daily-takeaways-report',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/takeaways',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
