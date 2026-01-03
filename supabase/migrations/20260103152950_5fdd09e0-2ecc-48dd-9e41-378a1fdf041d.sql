-- Add columns for Exa search tracking to state_licenses
ALTER TABLE public.state_licenses 
ADD COLUMN IF NOT EXISTS zillow_url text,
ADD COLUMN IF NOT EXISTS exa_search_notes text,
ADD COLUMN IF NOT EXISTS exa_searched_at timestamp with time zone;