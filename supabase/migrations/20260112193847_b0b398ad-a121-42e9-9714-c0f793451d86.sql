-- Add memo23 tracking columns to state_licenses for California pipeline
ALTER TABLE state_licenses 
ADD COLUMN IF NOT EXISTS zillow_scraped_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS memo23_status TEXT,
ADD COLUMN IF NOT EXISTS memo23_rating NUMERIC,
ADD COLUMN IF NOT EXISTS memo23_reviews INTEGER,
ADD COLUMN IF NOT EXISTS memo23_error TEXT,
ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES professionals(id);

-- Create index for faster queries on unscraped CA agents
CREATE INDEX IF NOT EXISTS idx_state_licenses_ca_unscraped 
ON state_licenses (state, exa_searched_at) 
WHERE zillow_url IS NOT NULL AND zillow_scraped_at IS NULL;