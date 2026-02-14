-- Certification tier enum and professionals/crm_leads columns for funnel
-- Annual option: 2 months free (10 months price for 12 months)

DO $$ BEGIN
  CREATE TYPE certification_tier AS ENUM ('listed', 'certified', 'accredited', 'underwritten');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- professionals: certification tier and billing fields
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS current_tier certification_tier DEFAULT 'listed',
  ADD COLUMN IF NOT EXISTS artifact_issued BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_diligence_check TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS annual_review_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_bill_date TIMESTAMPTZ;

COMMENT ON COLUMN professionals.current_tier IS 'listed (default), certified (free + badge), accredited ($50/mo), underwritten ($150/mo)';
COMMENT ON COLUMN professionals.next_bill_date IS 'NULL for free tiers (listed, certified). Next billing date for paid tiers.';

-- certification_pricing_config: dynamic pricing for funnel (no code redeploy)
CREATE TABLE IF NOT EXISTS public.certification_pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier certification_tier NOT NULL UNIQUE,
  monthly_price INTEGER NOT NULL DEFAULT 0,
  payload_weight TEXT,
  refresh_cadence TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Annual = 2 months free (10 months price for 12 months)
CREATE INDEX IF NOT EXISTS idx_certification_pricing_tier ON public.certification_pricing_config(tier);

ALTER TABLE public.certification_pricing_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read certification pricing"
  ON public.certification_pricing_config FOR SELECT USING (is_active = true);

-- Seed initial prices
INSERT INTO public.certification_pricing_config (tier, monthly_price, payload_weight, refresh_cadence)
VALUES
  ('listed', 0, 'basic', 'public_data_only'),
  ('certified', 0, 'standard', 'annual'),
  ('accredited', 50, 'enhanced', 'monthly'),
  ('underwritten', 150, 'maximum', 'real_time')
ON CONFLICT (tier) DO UPDATE SET
  monthly_price = EXCLUDED.monthly_price,
  payload_weight = EXCLUDED.payload_weight,
  refresh_cadence = EXCLUDED.refresh_cadence,
  updated_at = now();

-- crm_leads: add tier and next_bill_date if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'crm_leads') THEN
    ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS certification_tier certification_tier;
    ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS next_bill_date TIMESTAMPTZ;
  END IF;
END $$;
