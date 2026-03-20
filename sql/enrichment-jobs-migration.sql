-- Enrichment Pipeline Parallelization
-- Migration: enrichment_jobs table + enrichment_progress view + stale claim recovery

-- ============================================================
-- Table: enrichment_jobs
-- ============================================================
CREATE TABLE IF NOT EXISTS enrichment_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  license_id UUID NOT NULL REFERENCES state_licenses(id),
  state TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'prequalify',  -- 'prequalify' or 'deep'
  status TEXT NOT NULL DEFAULT 'pending',     -- 'pending', 'claimed', 'complete', 'failed', 'skip'
  worker_id TEXT,                             -- identifies which worker claimed it
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  serper_done BOOLEAN DEFAULT FALSE,
  exa_done BOOLEAN DEFAULT FALSE,
  memo23_done BOOLEAN DEFAULT FALSE,
  deepseek_done BOOLEAN DEFAULT FALSE,
  prequalified BOOLEAN,                      -- result of phase 1
  error TEXT,
  retry_count INT DEFAULT 0,
  cost_cents NUMERIC(10,4) DEFAULT 0,        -- track per-job cost
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_status ON enrichment_jobs(status, phase);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_worker ON enrichment_jobs(worker_id, status);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_license ON enrichment_jobs(license_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_state_phase ON enrichment_jobs(state, phase, status);

-- ============================================================
-- View: enrichment_progress (dashboard monitoring)
-- ============================================================
CREATE OR REPLACE VIEW enrichment_progress AS
SELECT
  state,
  phase,
  status,
  COUNT(*) as count,
  MIN(claimed_at) as oldest_claim,
  MAX(completed_at) as latest_completion,
  SUM(cost_cents) as total_cost_cents
FROM enrichment_jobs
GROUP BY state, phase, status
ORDER BY state, phase, status;

-- ============================================================
-- RLS policies
-- ============================================================
ALTER TABLE enrichment_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on enrichment_jobs"
  ON enrichment_jobs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated read access on enrichment_jobs"
  ON enrichment_jobs FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================
-- Function: claim_enrichment_batch (atomic row claiming)
-- ============================================================
CREATE OR REPLACE FUNCTION claim_enrichment_batch(
  p_worker_id TEXT,
  p_phase TEXT,
  p_batch_size INT DEFAULT 500
)
RETURNS SETOF enrichment_jobs
LANGUAGE sql
AS $$
  UPDATE enrichment_jobs
  SET status = 'claimed',
      worker_id = p_worker_id,
      claimed_at = NOW()
  WHERE id IN (
    SELECT id FROM enrichment_jobs
    WHERE status = 'pending'
      AND phase = p_phase
    ORDER BY id
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

-- ============================================================
-- Function: reset_stale_claims (crash recovery)
-- Called by pg_cron every 10 minutes
-- ============================================================
CREATE OR REPLACE FUNCTION reset_stale_claims()
RETURNS INT
LANGUAGE sql
AS $$
  WITH reset AS (
    UPDATE enrichment_jobs
    SET status = 'pending', worker_id = NULL, claimed_at = NULL
    WHERE status = 'claimed'
      AND claimed_at < NOW() - INTERVAL '15 minutes'
    RETURNING id
  )
  SELECT COUNT(*)::int FROM reset;
$$;

-- ============================================================
-- Function: seed_enrichment_jobs (per state)
-- ============================================================
CREATE OR REPLACE FUNCTION seed_enrichment_jobs(p_state TEXT)
RETURNS INT
LANGUAGE sql
AS $$
  WITH inserted AS (
    INSERT INTO enrichment_jobs (license_id, state, phase)
    SELECT id, state, 'prequalify'
    FROM state_licenses
    WHERE state = p_state
      AND exa_prequalified IS NOT TRUE
      AND id NOT IN (SELECT license_id FROM enrichment_jobs)
    RETURNING id
  )
  SELECT COUNT(*)::int FROM inserted;
$$;

-- ============================================================
-- Function: promote_to_deep (phase transition)
-- ============================================================
CREATE OR REPLACE FUNCTION promote_to_deep()
RETURNS INT
LANGUAGE sql
AS $$
  WITH inserted AS (
    INSERT INTO enrichment_jobs (license_id, state, phase)
    SELECT license_id, state, 'deep'
    FROM enrichment_jobs
    WHERE phase = 'prequalify'
      AND prequalified = TRUE
      AND license_id NOT IN (
        SELECT license_id FROM enrichment_jobs WHERE phase = 'deep'
      )
    RETURNING id
  )
  SELECT COUNT(*)::int FROM inserted;
$$;

-- ============================================================
-- pg_cron: stale claim recovery every 10 minutes
-- (Run this manually in SQL editor if pg_cron extension is enabled)
-- ============================================================
-- SELECT cron.schedule('reset-stale-enrichment-claims', '*/10 * * * *', 'SELECT reset_stale_claims()');
