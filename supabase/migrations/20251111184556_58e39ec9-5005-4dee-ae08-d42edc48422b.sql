-- Add license_number field to professionals table
ALTER TABLE public.professionals
ADD COLUMN IF NOT EXISTS license_number TEXT,
ADD COLUMN IF NOT EXISTS license_verified_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster license lookups
CREATE INDEX IF NOT EXISTS idx_professionals_license ON public.professionals(license_number) WHERE license_number IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.professionals.license_number IS 'State-issued real estate license number';
COMMENT ON COLUMN public.professionals.license_verified_at IS 'Timestamp when license was last verified';