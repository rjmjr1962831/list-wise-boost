-- Run this in Supabase Dashboard → SQL Editor (one-time) so daily-certification-update works.
-- Adds certification_updated_at and index; sets refresh_cadence on certification_pricing_config.

ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS certification_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN professionals.certification_updated_at IS 'Last time the daily certification update job ran enrichment for this agent.';

UPDATE certification_pricing_config
SET refresh_cadence = 'daily', updated_at = now()
WHERE tier = 'underwritten' AND (refresh_cadence IS NULL OR refresh_cadence != 'daily');

UPDATE certification_pricing_config
SET refresh_cadence = 'every_two_weeks', updated_at = now()
WHERE tier = 'audited' AND (refresh_cadence IS NULL OR refresh_cadence NOT IN ('every_two_weeks'));

UPDATE certification_pricing_config
SET refresh_cadence = 'monthly', updated_at = now()
WHERE tier = 'certified' AND (refresh_cadence IS NULL OR refresh_cadence != 'monthly');

CREATE INDEX IF NOT EXISTS idx_professionals_certification_updated_at
  ON professionals (certification_updated_at)
  WHERE active = true AND zillow_profile_url IS NOT NULL;
