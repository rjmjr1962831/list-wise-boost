-- Add ranking capture columns to professionals table
ALTER TABLE professionals 
ADD COLUMN IF NOT EXISTS zillow_search_page integer,
ADD COLUMN IF NOT EXISTS zillow_search_position integer,
ADD COLUMN IF NOT EXISTS zillow_search_total integer,
ADD COLUMN IF NOT EXISTS zillow_rank_captured_at timestamptz,
ADD COLUMN IF NOT EXISTS zillow_search_city text;

-- Add index for faster lookups by zillow_profile_url
CREATE INDEX IF NOT EXISTS idx_professionals_zillow_profile_url ON professionals(zillow_profile_url);

-- Add index for ranking queries
CREATE INDEX IF NOT EXISTS idx_professionals_zillow_rank ON professionals(zillow_search_city, zillow_search_position) WHERE zillow_rank_captured_at IS NOT NULL;