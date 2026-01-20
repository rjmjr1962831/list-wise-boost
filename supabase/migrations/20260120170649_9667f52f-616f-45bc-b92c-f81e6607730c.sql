-- Add column to store historical short codes for backwards compatibility
ALTER TABLE public.professionals 
ADD COLUMN IF NOT EXISTS previous_short_codes text[] DEFAULT '{}';

-- Create index for efficient lookups on previous short codes
CREATE INDEX IF NOT EXISTS idx_professionals_previous_short_codes 
ON public.professionals USING GIN (previous_short_codes);

-- Add comment explaining the column
COMMENT ON COLUMN public.professionals.previous_short_codes IS 'Array of previously used short codes that should still redirect to this professional';