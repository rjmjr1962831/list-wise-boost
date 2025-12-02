-- Add verified data columns to professionals table for LLM-optimized citations

-- License details
ALTER TABLE public.professionals 
ADD COLUMN IF NOT EXISTS license_type text,
ADD COLUMN IF NOT EXISTS license_status text DEFAULT 'Active',
ADD COLUMN IF NOT EXISTS license_issued_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS license_expires_at timestamp with time zone;

-- Card metadata
ALTER TABLE public.professionals 
ADD COLUMN IF NOT EXISTS card_created_at timestamp with time zone DEFAULT now();

-- Verified structured data (JSONB)
ALTER TABLE public.professionals 
ADD COLUMN IF NOT EXISTS certifications_verified jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS awards_verified jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS platform_reviews jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS data_sources_log jsonb DEFAULT '[]'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN public.professionals.license_type IS 'License type: Salesperson, Broker, Associate Broker';
COMMENT ON COLUMN public.professionals.license_status IS 'License status: Active, Inactive, Expired, Suspended, Revoked';
COMMENT ON COLUMN public.professionals.license_issued_at IS 'Original license issue date from state licensing board';
COMMENT ON COLUMN public.professionals.license_expires_at IS 'License expiration date';
COMMENT ON COLUMN public.professionals.card_created_at IS 'When this agent was first added to Top10Lists';
COMMENT ON COLUMN public.professionals.certifications_verified IS 'Array of verified certifications with issuing org and verification timestamps';
COMMENT ON COLUMN public.professionals.awards_verified IS 'Array of verified awards with issuing org and verification timestamps';
COMMENT ON COLUMN public.professionals.platform_reviews IS 'Breakdown of reviews by platform (Google, Zillow, etc.) with verification dates';
COMMENT ON COLUMN public.professionals.data_sources_log IS 'Log of when data was last fetched from each source';