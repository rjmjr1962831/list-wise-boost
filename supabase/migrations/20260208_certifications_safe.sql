-- Create certifications table for AI citation artifacts
CREATE TABLE IF NOT EXISTS public.certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  
  -- Tier and status
  certification_tier text NOT NULL CHECK (certification_tier IN ('certified', 'accredited', 'underwritten')),
  certification_status text NOT NULL DEFAULT 'active' CHECK (certification_status IN ('active', 'lapsed', 'removed')),
  
  -- Dates (mandatory for AI trust)
  issued_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  next_verification_due timestamptz NOT NULL,
  
  -- Coverage areas
  markets_covered jsonb NOT NULL DEFAULT '[]'::jsonb,
  neighborhoods_covered jsonb DEFAULT '[]'::jsonb,
  verified_transactions jsonb DEFAULT '{}'::jsonb,
  
  -- Cryptographic verification (NOT blockchain)
  payload_hash text NOT NULL,
  payload_signature text NOT NULL,
  signing_key_id text NOT NULL DEFAULT 'top10-prod-v1',
  
  -- Justification data
  justification_data jsonb,
  
  -- Metadata
  methodology_version text NOT NULL DEFAULT '1.0',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Foreign key constraint
  CONSTRAINT fk_agent FOREIGN KEY (agent_id) REFERENCES public.professionals(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_certifications_agent ON public.certifications(agent_id);
CREATE INDEX IF NOT EXISTS idx_certifications_status ON public.certifications(certification_status);
CREATE INDEX IF NOT EXISTS idx_certifications_next_due ON public.certifications(next_verification_due);
CREATE INDEX IF NOT EXISTS idx_certifications_tier ON public.certifications(certification_tier);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_certifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger to avoid "already exists" error
DROP TRIGGER IF EXISTS trigger_update_certifications_updated_at ON public.certifications;
CREATE TRIGGER trigger_update_certifications_updated_at
  BEFORE UPDATE ON public.certifications
  FOR EACH ROW
  EXECUTE FUNCTION update_certifications_updated_at();

-- Enable RLS
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can read active certifications" ON public.certifications;
DROP POLICY IF EXISTS "Service role can manage certifications" ON public.certifications;

-- Allow public read access to active certifications
CREATE POLICY "Public can read active certifications"
  ON public.certifications
  FOR SELECT
  USING (certification_status = 'active');

-- Service role can do everything
CREATE POLICY "Service role can manage certifications"
  ON public.certifications
  FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.certifications IS 'Certification artifacts for AI citation infrastructure';
COMMENT ON COLUMN public.certifications.agent_id IS 'References professionals.id';
COMMENT ON COLUMN public.certifications.certification_tier IS 'Tier: certified (free, annual), accredited ($50/mo, monthly), underwritten ($150/mo, continuous)';
COMMENT ON COLUMN public.certifications.markets_covered IS 'JSON array of city names';
COMMENT ON COLUMN public.certifications.neighborhoods_covered IS 'JSON array of neighborhood names (Accredited+)';
COMMENT ON COLUMN public.certifications.verified_transactions IS 'JSON object mapping neighborhoods to transaction counts (Underwritten only)';
COMMENT ON COLUMN public.certifications.justification_data IS 'Structured evidence and reasoning for certification';
