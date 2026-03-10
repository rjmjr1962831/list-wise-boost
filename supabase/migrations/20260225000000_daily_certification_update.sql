-- Daily certification update: track last run and ensure refresh_cadence supports daily/two-week/monthly/annual.
-- Runs at midnight MST (07:00 UTC) via cron → daily-certification-update edge function.

-- Professionals: when we last ran certification (memo23 enrichment) for this agent
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS certification_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN professionals.certification_updated_at IS 'Last time the daily certification update job ran enrichment for this agent (set regardless of success/fail). Used with refresh_cadence to determine due date.';

-- Ensure certification_pricing_config has refresh_cadence values the scheduler uses:
-- daily, every_two_weeks, monthly, annual, quarterly
UPDATE certification_pricing_config
SET refresh_cadence = 'daily', updated_at = now()
WHERE tier = 'underwritten' AND (refresh_cadence IS NULL OR refresh_cadence != 'daily');

UPDATE certification_pricing_config
SET refresh_cadence = 'monthly', updated_at = now()
WHERE tier = 'audited' AND (refresh_cadence IS NULL OR refresh_cadence != 'monthly');

UPDATE certification_pricing_config
SET refresh_cadence = 'monthly', updated_at = now()
WHERE tier = 'certified' AND (refresh_cadence IS NULL OR refresh_cadence != 'monthly');

-- Listed stays as public_data_only (no scheduled certification)
-- Index to speed due-date query (optional)
CREATE INDEX IF NOT EXISTS idx_professionals_certification_updated_at
  ON professionals (certification_updated_at)
  WHERE active = true AND zillow_profile_url IS NOT NULL;
