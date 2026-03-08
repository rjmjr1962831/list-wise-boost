-- Extend geo_audit_results to support AICS v1 model
-- Adds: four-tier scores, recency signals, GPT query results, pillar breakdown

ALTER TABLE public.geo_audit_results
  ADD COLUMN IF NOT EXISTS score_unlisted        integer,
  ADD COLUMN IF NOT EXISTS score_listed          integer,
  ADD COLUMN IF NOT EXISTS aics_version          text DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS recency_score         integer,
  ADD COLUMN IF NOT EXISTS recency_label         text,
  ADD COLUMN IF NOT EXISTS most_recent_signal    text,
  ADD COLUMN IF NOT EXISTS exa_sources           text[],
  ADD COLUMN IF NOT EXISTS exa_source_count      integer,
  ADD COLUMN IF NOT EXISTS pillar_identity       integer,
  ADD COLUMN IF NOT EXISTS pillar_authority      integer,
  ADD COLUMN IF NOT EXISTS pillar_social         integer,
  ADD COLUMN IF NOT EXISTS pillar_technical      integer,
  ADD COLUMN IF NOT EXISTS pillar_citability     integer,
  ADD COLUMN IF NOT EXISTS gpt_unprompted_result text,
  ADD COLUMN IF NOT EXISTS gpt_unprompted_named  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS gpt_named_result      text,
  ADD COLUMN IF NOT EXISTS gpt_named_confirmed   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS merit_gate_pass       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS merit_gate_failures   text[],
  ADD COLUMN IF NOT EXISTS remediation_diy       text,
  ADD COLUMN IF NOT EXISTS remediation_dfy       text;

COMMENT ON COLUMN public.geo_audit_results.score_unlisted       IS 'AICS score before Top10Lists (organic signals only)';
COMMENT ON COLUMN public.geo_audit_results.score_listed         IS 'AICS projected score at Listed tier';
COMMENT ON COLUMN public.geo_audit_results.recency_score        IS 'Recency signal 0-10 based on most recent review/activity';
COMMENT ON COLUMN public.geo_audit_results.gpt_unprompted_named IS 'True if GPT named this agent without being asked';
COMMENT ON COLUMN public.geo_audit_results.gpt_named_confirmed  IS 'True if GPT could describe agent when asked by name';
COMMENT ON COLUMN public.geo_audit_results.remediation_diy      IS 'Personalized DIY action list with estimated AICS impact';
COMMENT ON COLUMN public.geo_audit_results.remediation_dfy      IS 'DFY consulting scope and delivery gates';
