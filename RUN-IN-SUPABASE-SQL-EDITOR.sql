-- Copy everything below and paste into Supabase SQL Editor, then Run.
-- Rename accredited tier to audited (site-wide)

ALTER TYPE certification_tier ADD VALUE IF NOT EXISTS 'audited';

ALTER TABLE certifications DROP CONSTRAINT IF EXISTS certifications_certification_tier_check;
UPDATE certifications SET certification_tier = 'audited' WHERE certification_tier = 'accredited';
ALTER TABLE certifications ADD CONSTRAINT certifications_certification_tier_check
  CHECK (certification_tier IN ('certified', 'audited', 'underwritten'));

UPDATE professionals SET current_tier = 'audited' WHERE current_tier = 'accredited';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'certification_tier'
  ) THEN
    EXECUTE 'UPDATE crm_leads SET certification_tier = ''audited'' WHERE certification_tier = ''accredited''';
  END IF;
END $$;

INSERT INTO certification_pricing_config (tier, monthly_price, payload_weight, refresh_cadence)
VALUES ('audited', 100, 'enhanced', 'quarterly')
ON CONFLICT (tier) DO UPDATE SET
  refresh_cadence = 'quarterly',
  updated_at = now();

DELETE FROM certification_pricing_config WHERE tier = 'accredited'::certification_tier;

COMMENT ON COLUMN professionals.current_tier IS 'listed (default), certified (free + badge), audited ($100/mo, quarterly), underwritten ($150/mo)';
