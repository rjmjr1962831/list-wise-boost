-- Top10Lists Artifact Badge System - Certifications Table
-- Stores certification data for agent artifact pages and machine-readable payloads

CREATE TABLE IF NOT EXISTS public.certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id text NOT NULL REFERENCES public.professionals(id),
  
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
CREATE INDEX idx_certifications_professional ON public.certifications(professional_id);
CREATE INDEX idx_certifications_status ON public.certifications(certification_status);
CREATE INDEX idx_certifications_tier ON public.certifications(certification_tier);
CREATE INDEX idx_certifications_verification_due ON public.certifications(next_verification_due);

-- Enable RLS
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;

-- Public can read active certifications (for artifact pages and payloads)
CREATE POLICY "Anyone can read active certifications"
  ON public.certifications FOR SELECT
  USING (certification_status = 'active');

-- Only admins can modify certifications (via service role)
CREATE POLICY "Service role can manage certifications"
  ON public.certifications FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Trigger to auto-update updated_at
CREATE TRIGGER update_certifications_updated_at
  BEFORE UPDATE ON public.certifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed test data for George Laughton (professional_id = 5289)
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
  '5289',
  'accredited',
  'active',
  '2026-02-01T00:00:00Z',
  '2026-02-10T00:00:00Z',
  '2026-03-10T00:00:00Z',
  '1.0',
  ARRAY['Tucson'],
  ARRAY['Downtown Tucson', 'Foothills', 'Oro Valley'],
  jsonb_build_object(
    'selection_rationale', 'Top10Lists.us selected George Laughton based on perfect client satisfaction across 20 years and active leadership in the Sierra Vista Chamber of Commerce. Community engagement combined with specialized military relocation expertise distinguishes him among Tucson-area professionals.',
    'verified_transactions', jsonb_build_object(
      'Downtown Tucson', 145,
      'Foothills', 98,
      'Oro Valley', 77
    ),
    'evidence_considered', jsonb_build_array(
      '5.0 star rating across 45 reviews',
      '320 lifetime transactions',
      'Active chamber board member',
      'Military relocation specialist certification'
    )
  )
) ON CONFLICT (professional_id) DO NOTHING;

-- Comments
COMMENT ON TABLE public.certifications IS 'Agent certifications for artifact badge system with tier-based payloads';
COMMENT ON COLUMN public.certifications.certification_tier IS 'certified (free), accredited ($50/mo), underwritten ($150/mo)';
COMMENT ON COLUMN public.certifications.justification_data IS 'Rich context: selection_rationale, verified_transactions, evidence_considered';
