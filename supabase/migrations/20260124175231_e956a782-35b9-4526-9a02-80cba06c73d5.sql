-- Create pipeline_alerts table for database-based logging
CREATE TABLE IF NOT EXISTS pipeline_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  title TEXT NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}',
  acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient lookups by pipeline
CREATE INDEX idx_pipeline_alerts_lookup 
  ON pipeline_alerts (pipeline, acknowledged, created_at DESC);

-- Partial index for unacknowledged critical alerts
CREATE INDEX idx_pipeline_alerts_unacked_critical 
  ON pipeline_alerts (created_at DESC) 
  WHERE severity IN ('error', 'critical') AND acknowledged = false;

-- Enable RLS
ALTER TABLE pipeline_alerts ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions use service role)
CREATE POLICY "Service role has full access to pipeline_alerts"
  ON pipeline_alerts
  FOR ALL
  USING (true)
  WITH CHECK (true);