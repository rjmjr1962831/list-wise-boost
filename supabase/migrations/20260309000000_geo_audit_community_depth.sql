-- Add community depth scoring columns to geo_audit_results

ALTER TABLE public.geo_audit_results
  ADD COLUMN IF NOT EXISTS community_score_current integer,
  ADD COLUMN IF NOT EXISTS community_score_audited integer,
  ADD COLUMN IF NOT EXISTS community_score_underwritten integer,
  ADD COLUMN IF NOT EXISTS recency_boost_audited integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recency_boost_underwritten integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS community_signals_db text[],
  ADD COLUMN IF NOT EXISTS signals_990_eligible text[];

COMMENT ON COLUMN public.geo_audit_results.community_score_current IS 'Depth-weighted community score from public Exa data only';
COMMENT ON COLUMN public.geo_audit_results.community_score_audited IS 'Depth-weighted community score from DB with confidence discounts';
COMMENT ON COLUMN public.geo_audit_results.community_score_underwritten IS 'Depth-weighted community score from DB, no discount';
COMMENT ON COLUMN public.geo_audit_results.recency_boost_audited IS 'Recency boost for Audited tier (always 1)';
COMMENT ON COLUMN public.geo_audit_results.recency_boost_underwritten IS 'Recency boost for Underwritten tier (always 2)';
COMMENT ON COLUMN public.geo_audit_results.community_signals_db IS 'Signals from community_roles / notable_achievements / awards_verified';
COMMENT ON COLUMN public.geo_audit_results.signals_990_eligible IS 'Org names flagged for ProPublica lookup';
