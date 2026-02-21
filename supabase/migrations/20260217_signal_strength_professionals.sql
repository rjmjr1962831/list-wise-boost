-- Signal strength numbers for dashboard and payload projections
-- See PROJECT-KNOWLEDGE: signal_score (Internal Confidence Rating), audited_projected_signal, certified_projected_signal

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS signal_score integer,
  ADD COLUMN IF NOT EXISTS audited_projected_signal integer,
  ADD COLUMN IF NOT EXISTS certified_projected_signal integer;

COMMENT ON COLUMN public.professionals.signal_score IS 'Internal Confidence Rating (e.g. 0-100). Populate per agent for dashboard display.';
COMMENT ON COLUMN public.professionals.audited_projected_signal IS 'Projected signal/rating if agent were at Audited tier. For tier comparison in PayloadSection.';
COMMENT ON COLUMN public.professionals.certified_projected_signal IS 'Projected signal/rating if agent were downgraded to Certified. For tier comparison in PayloadSection.';
