-- Table for daily comprehensive health check results
CREATE TABLE IF NOT EXISTS health_check_daily_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  run_date date NOT NULL DEFAULT CURRENT_DATE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  total_checks int,
  passed int,
  warnings int,
  failed int,
  critical_failures int,
  overall_status text, -- 'green', 'yellow', 'red'
  results jsonb,
  email_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hcdr_run_date ON health_check_daily_runs(run_date);

-- Enable RLS
ALTER TABLE health_check_daily_runs ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "service_role_all" ON health_check_daily_runs
  FOR ALL USING (auth.role() = 'service_role');

-- pg_cron job: 7:00 AM MST (14:00 UTC) daily
-- Run this manually in Supabase SQL Editor:
--
-- SELECT cron.schedule(
--   'health-check-daily',
--   '0 14 * * *',
--   $$SELECT net.http_post(
--     url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/health-check-daily',
--     body := '{}'::jsonb,
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
--       'Content-Type', 'application/json'
--     )
--   )$$
-- );
