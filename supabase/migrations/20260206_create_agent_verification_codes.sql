-- Create agent_verification_codes table
CREATE TABLE IF NOT EXISTS public.agent_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  delivery_method TEXT NOT NULL DEFAULT 'email',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_agent_verification_codes_professional_id 
  ON public.agent_verification_codes(professional_id);

CREATE INDEX IF NOT EXISTS idx_agent_verification_codes_code 
  ON public.agent_verification_codes(code);

-- Enable RLS
ALTER TABLE public.agent_verification_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do anything
CREATE POLICY "Service role can manage verification codes"
  ON public.agent_verification_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comment
COMMENT ON TABLE public.agent_verification_codes IS 'Stores verification codes for agent authentication';
