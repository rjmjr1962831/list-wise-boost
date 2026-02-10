-- Add badge tier tracking columns to professionals table

ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS badge_tier TEXT DEFAULT 'certified' CHECK (badge_tier IN ('certified', 'accredited', 'underwritten')),
ADD COLUMN IF NOT EXISTS badge_status TEXT DEFAULT 'active' CHECK (badge_status IN ('active', 'grace_period', 'lapsed')),
ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_failed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ;

-- Add indexes for payment status queries
CREATE INDEX IF NOT EXISTS idx_professionals_badge_status ON professionals(badge_status);
CREATE INDEX IF NOT EXISTS idx_professionals_grace_period ON professionals(grace_period_ends_at) WHERE badge_status = 'grace_period';

-- Add columns to certifications table if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'certifications') THEN
    ALTER TABLE certifications
    ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'certified',
    ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
  END IF;
END $$;
