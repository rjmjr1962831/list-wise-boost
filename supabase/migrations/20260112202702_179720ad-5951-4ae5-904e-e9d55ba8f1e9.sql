-- Add Exa prequalification columns to state_licenses
ALTER TABLE public.state_licenses 
ADD COLUMN IF NOT EXISTS exa_score numeric,
ADD COLUMN IF NOT EXISTS exa_rating numeric,
ADD COLUMN IF NOT EXISTS exa_reviews integer,
ADD COLUMN IF NOT EXISTS exa_prequalified boolean DEFAULT false;

-- Create index for finding prequalified agents ready for Memo23
CREATE INDEX IF NOT EXISTS idx_state_licenses_exa_prequalified 
ON public.state_licenses (state, exa_prequalified) 
WHERE exa_prequalified = true AND zillow_scraped_at IS NULL;