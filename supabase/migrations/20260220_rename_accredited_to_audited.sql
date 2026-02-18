-- Rename accredited tier to audited (site-wide)
-- Accredited has been renamed to Audited; Audited refreshes quarterly.

-- 1. Add 'audited' to certification_tier enum
ALTER TYPE certification_tier ADD VALUE IF NOT EXISTS 'audited';

-- 2. Update certifications table CHECK to allow audited, then migrate data
ALTER TABLE certifications DROP CONSTRAINT IF EXISTS certifications_certification_tier_check;
UPDATE certifications SET certification_tier = 'audited' WHERE certification_tier = 'accredited';
ALTER TABLE certifications ADD CONSTRAINT certifications_certification_tier_check
  CHECK (certification_tier IN ('certified', 'audited', 'underwritten'));

-- 3. Update professionals.current_tier
UPDATE professionals SET current_tier = 'audited' WHERE current_tier = 'accredited';

-- 4. Update crm_leads.certification_tier if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'certification_tier'
  ) THEN
    EXECUTE 'UPDATE crm_leads SET certification_tier = ''audited'' WHERE certification_tier = ''accredited''';
  END IF;
END $$;

-- 5. certification_pricing_config: add audited row (quarterly), remove accredited
INSERT INTO certification_pricing_config (tier, monthly_price, payload_weight, refresh_cadence)
VALUES ('audited', 50, 'enhanced', 'quarterly')
ON CONFLICT (tier) DO UPDATE SET
  refresh_cadence = 'quarterly',
  updated_at = now();

-- Remove accredited row
DELETE FROM certification_pricing_config WHERE tier = 'accredited'::certification_tier;

-- 6. Update comments
COMMENT ON COLUMN professionals.current_tier IS 'listed (default), certified (free + badge), audited ($50/mo, quarterly), underwritten ($150/mo)';
