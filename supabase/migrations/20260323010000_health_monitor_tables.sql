-- Health monitor and GEO audit tracking tables

CREATE TABLE IF NOT EXISTS health_monitor_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  total_checks int NOT NULL DEFAULT 0,
  passed int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  alert_sent boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_health_monitor_runs_started ON health_monitor_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS geo_audit_findings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  found_at timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL,          -- 'numbers_mismatch', 'stale_language', 'dead_link', 'jsonld', 'sitemap', etc.
  severity text NOT NULL,          -- 'broken', 'inconsistent', 'stale'
  description text NOT NULL,
  expected text,
  actual text,
  url text,
  status text NOT NULL DEFAULT 'open',  -- 'open', 'auto_fixed', 'pending_deploy', 'resolved'
  fix_applied text,
  resolved_at timestamptz,
  audit_run_id uuid
);

CREATE INDEX idx_geo_audit_findings_status ON geo_audit_findings (status);
CREATE INDEX idx_geo_audit_findings_found ON geo_audit_findings (found_at DESC);

-- RLS policies (service role bypasses, but good practice)
ALTER TABLE health_monitor_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_audit_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_health_monitor" ON health_monitor_runs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_geo_audit" ON geo_audit_findings
  FOR ALL USING (auth.role() = 'service_role');
