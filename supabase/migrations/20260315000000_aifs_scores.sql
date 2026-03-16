-- AIFS (AI Fingerprint Score) infrastructure
-- Replaces AICS with SERP-based entity authority scoring

-- 1. New table: aifs_scores
CREATE TABLE IF NOT EXISTS aifs_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,

  -- Final score
  aifs_total INTEGER NOT NULL CHECK (aifs_total BETWEEN 0 AND 100),
  aifs_band TEXT NOT NULL CHECK (aifs_band IN ('invisible', 'fragmented', 'recognized', 'high_fidelity')),
  aifs_version TEXT NOT NULL DEFAULT 'v1',

  -- SERP signal breakdown (Serper.dev) -- max 60 pts
  serp_knowledge_graph BOOLEAN DEFAULT FALSE,
  serp_knowledge_graph_score NUMERIC(5,2) DEFAULT 0,
  serp_sitelink_salience BOOLEAN DEFAULT FALSE,
  serp_sitelink_salience_score NUMERIC(5,2) DEFAULT 0,
  serp_related_citations BOOLEAN DEFAULT FALSE,
  serp_related_citations_score NUMERIC(5,2) DEFAULT 0,
  serp_third_party_count INTEGER DEFAULT 0,
  serp_third_party_score NUMERIC(5,2) DEFAULT 0,
  serp_organic_visibility_score NUMERIC(5,2) DEFAULT 0,

  -- Internal signal breakdown -- max 40 pts
  internal_data_freshness_days INTEGER,
  internal_data_freshness_score NUMERIC(5,2) DEFAULT 0,
  internal_selection_rationale BOOLEAN DEFAULT FALSE,
  internal_selection_rationale_score NUMERIC(5,2) DEFAULT 0,
  internal_crypto_verified BOOLEAN DEFAULT FALSE,
  internal_crypto_verified_score NUMERIC(5,2) DEFAULT 0,
  internal_data_score NUMERIC(5,2) DEFAULT 0,

  -- Gap analysis and tier lift
  gap_analysis TEXT[] DEFAULT '{}',
  tier_lift_projection JSONB DEFAULT '{}',

  -- Raw Serper response (for debugging/audit)
  serper_query TEXT,
  serper_raw JSONB,

  -- Timestamps
  scored_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_aifs_agent UNIQUE (agent_id)
);

CREATE INDEX idx_aifs_scores_scored_at ON aifs_scores(scored_at);
CREATE INDEX idx_aifs_scores_band ON aifs_scores(aifs_band);

ALTER TABLE aifs_scores ENABLE ROW LEVEL SECURITY;

-- 2. Add denormalized columns to professionals
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS aifs_score INTEGER,
  ADD COLUMN IF NOT EXISTS aifs_band TEXT;

-- 3. Register cron (every 5 minutes)
SELECT cron.unschedule('batch-aifs-score-run')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'batch-aifs-score-run');

SELECT cron.schedule(
  'batch-aifs-score-run',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/batch-aifs-score',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
