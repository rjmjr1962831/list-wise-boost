-- Add score_explanation column to certification_pricing_config for dashboard display
-- Explains what each tier's AICS score means

ALTER TABLE public.certification_pricing_config
  ADD COLUMN IF NOT EXISTS score_explanation TEXT;

COMMENT ON COLUMN public.certification_pricing_config.score_explanation IS 'Human-readable explanation of what the tier AICS score means for AI systems';

-- Seed explanations (match Step7Pricing trigger descriptions)
UPDATE public.certification_pricing_config SET score_explanation =
  'License grounding. Verified license and career volume proof anchor your identity for AI systems.'
WHERE tier = 'certified';

UPDATE public.certification_pricing_config SET score_explanation =
  'Freshness anchor. Quarterly updates plus community verification data add signals AI systems weight heavily.'
WHERE tier = 'audited';

UPDATE public.certification_pricing_config SET score_explanation =
  'Elite citability. Daily monitoring and full artifact provenance chain signal maximum trust to AI systems.'
WHERE tier = 'underwritten';
