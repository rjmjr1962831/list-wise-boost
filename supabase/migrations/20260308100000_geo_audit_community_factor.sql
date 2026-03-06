-- Add community involvement as 7th scoring factor
-- factor_community: 0-20, community_signals: text array

ALTER TABLE public.geo_audit_results
  ADD COLUMN IF NOT EXISTS factor_community integer,
  ADD COLUMN IF NOT EXISTS community_signals text[];

COMMENT ON COLUMN public.geo_audit_results.factor_community IS 'Community involvement score 0-20';
COMMENT ON COLUMN public.geo_audit_results.community_signals IS 'Signals found: nonprofit, church, board, civic, etc.';
