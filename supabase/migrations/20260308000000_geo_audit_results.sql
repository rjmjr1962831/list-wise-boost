-- GEO audit results table for certified agent audits
-- Stores Exa search results, 6-factor scores, and remediation plans

CREATE TABLE IF NOT EXISTS public.geo_audit_results (
  agent_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  full_name text,
  city text,
  state text,
  brokerage text,
  audited_at timestamptz,
  score_current integer,
  score_audited integer,
  score_underwritten integer,
  factor_reviews integer,
  factor_platforms integer,
  factor_authority integer,
  factor_schema integer,
  factor_ai_optimization integer,
  factor_entity_clarity integer,
  review_count integer,
  review_rating decimal,
  zillow_reviews integer,
  google_reviews integer,
  platforms_found text[],
  raw_mentions text,
  authority_signals text[],
  remediation_plan text,
  notes text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'complete', 'error')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (agent_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_geo_audit_agent_id ON public.geo_audit_results(agent_id);

CREATE INDEX IF NOT EXISTS idx_geo_audit_status ON public.geo_audit_results(status);
CREATE INDEX IF NOT EXISTS idx_geo_audit_score_underwritten ON public.geo_audit_results(score_underwritten DESC NULLS LAST);

ALTER TABLE public.geo_audit_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to geo_audit_results"
  ON public.geo_audit_results
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.geo_audit_results IS 'GEO audit results from Exa search: 6-factor scores, projected tier scores, remediation plans';
