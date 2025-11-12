-- Add zip_code column to professionals table
ALTER TABLE public.professionals 
ADD COLUMN zip_code text;

-- Add index for faster zip code lookups
CREATE INDEX idx_professionals_zip_code ON public.professionals(zip_code);

-- Add comment
COMMENT ON COLUMN public.professionals.zip_code IS 'US zip code where the professional operates (e.g., 85295 for Gilbert, AZ)';