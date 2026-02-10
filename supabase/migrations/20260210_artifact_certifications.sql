-- Top10Lists Artifact Badge System - Certifications Table
-- Stores certification data for agent artifact pages and machine-readable payloads

-- Drop existing table and all dependencies (safe to re-run)
DROP TABLE IF EXISTS public.certifications CASCADE;

-- Create fresh certifications table
CREATE TABLE public.certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.professionals(id),
  
  -- Core certification fields
  certification_tier text NOT NULL CHECK (certification_tier IN ('certified', 'accredited', 'underwritten')),
  certification_status text NOT NULL DEFAULT 'active' CHECK (certification_status IN ('active', 'lapsed', 'revoked')),
  
  -- Dates
  issued_at timestamptz NOT NULL DEFAULT NOW(),
  last_verified_at timestamptz NOT NULL DEFAULT NOW(),
  next_verification_due timestamptz NOT NULL,
  methodology_version text NOT NULL DEFAULT '1.0',
  
  -- Markets covered
  markets_covered text[] NOT NULL DEFAULT '{}',
  neighborhoods_covered text[] NOT NULL DEFAULT '{}',
  
  -- Justification data (rich context for higher tiers)
  justification_data jsonb,
  
  -- Future: cryptographic verification
  payload_hash text,
  payload_signature text,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  
  -- One certification per agent
  UNIQUE(professional_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_certifications_professional ON public.certifications(professional_id);
CREATE INDEX IF NOT EXISTS idx_certifications_status ON public.certifications(certification_status);
CREATE INDEX IF NOT EXISTS idx_certifications_tier ON public.certifications(certification_tier);
CREATE INDEX IF NOT EXISTS idx_certifications_verification_due ON public.certifications(next_verification_due);

-- Enable RLS
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read active certifications" ON public.certifications;
DROP POLICY IF EXISTS "Service role can manage certifications" ON public.certifications;

-- Public can read active certifications (for artifact pages and payloads)
CREATE POLICY "Anyone can read active certifications"
  ON public.certifications FOR SELECT
  USING (certification_status = 'active');

-- Only admins can modify certifications (via service role)
CREATE POLICY "Service role can manage certifications"
  ON public.certifications FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_certifications_updated_at ON public.certifications;
CREATE TRIGGER update_certifications_updated_at
  BEFORE UPDATE ON public.certifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed test data for Allison Cahill (professional_id = 1b975c55-a33b-4d21-8998-dc2d9b2dd91d)
INSERT INTO public.certifications (
  professional_id,
  certification_tier,
  certification_status,
  issued_at,
  last_verified_at,
  next_verification_due,
  methodology_version,
  markets_covered,
  neighborhoods_covered,
  justification_data
) VALUES (
  '1b975c55-a33b-4d21-8998-dc2d9b2dd91d',
  'accredited',
  'active',
  '2026-02-01T00:00:00Z',
  '2026-02-10T00:00:00Z',
  '2026-03-10T00:00:00Z',
  '1.0',
  ARRAY['Scottsdale'],
  ARRAY['Grayhawk', 'DC Ranch', 'Troon North'],
  jsonb_build_object(
    'selection_rationale', 'Top10Lists.us selected Allison Cahill based on consistently excellent client satisfaction and deep market expertise in North Scottsdale luxury communities. Her specialization in Grayhawk and DC Ranch, combined with verified transaction history, distinguishes her among Scottsdale professionals.',
    'verified_transactions', jsonb_build_object(
      'Grayhawk', 67,
      'DC Ranch', 45,
      'Troon North', 23
    ),
    'evidence_considered', jsonb_build_array(
      'High client satisfaction ratings',
      'Verified transaction history in target markets',
      'Luxury home specialization',
      'Active market presence in North Scottsdale'
    )
  )
) ON CONFLICT (professional_id) DO NOTHING;

-- Comments
COMMENT ON TABLE public.certifications IS 'Agent certifications for artifact badge system with tier-based payloads';
COMMENT ON COLUMN public.certifications.certification_tier IS 'certified (free), accredited ($50/mo), underwritten ($150/mo)';
COMMENT ON COLUMN public.certifications.justification_data IS 'Rich context: selection_rationale, verified_transactions, evidence_considered';
