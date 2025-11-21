-- Add column to store complete raw scraper data for future reference
ALTER TABLE public.professionals 
ADD COLUMN IF NOT EXISTS raw_scraper_data jsonb DEFAULT NULL;

COMMENT ON COLUMN public.professionals.raw_scraper_data IS 'Complete raw data from scraper (memo23, agenscrape, etc.) stored for future reference';