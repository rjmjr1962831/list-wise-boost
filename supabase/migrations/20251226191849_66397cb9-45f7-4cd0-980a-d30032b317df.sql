-- Add Zillow columns to state_licenses table
ALTER TABLE state_licenses ADD COLUMN IF NOT EXISTS zillow_scraped_at TIMESTAMPTZ;
ALTER TABLE state_licenses ADD COLUMN IF NOT EXISTS zillow_status TEXT;
ALTER TABLE state_licenses ADD COLUMN IF NOT EXISTS zillow_url TEXT;
ALTER TABLE state_licenses ADD COLUMN IF NOT EXISTS zillow_rating NUMERIC(2,1);
ALTER TABLE state_licenses ADD COLUMN IF NOT EXISTS zillow_reviews INTEGER;
ALTER TABLE state_licenses ADD COLUMN IF NOT EXISTS total_sales INTEGER;
ALTER TABLE state_licenses ADD COLUMN IF NOT EXISTS sales_last_12_months INTEGER;
ALTER TABLE state_licenses ADD COLUMN IF NOT EXISTS years_experience INTEGER;
ALTER TABLE state_licenses ADD COLUMN IF NOT EXISTS price_range_min NUMERIC;
ALTER TABLE state_licenses ADD COLUMN IF NOT EXISTS price_range_max NUMERIC;
ALTER TABLE state_licenses ADD COLUMN IF NOT EXISTS avg_price NUMERIC;
ALTER TABLE state_licenses ADD COLUMN IF NOT EXISTS brokerage_name TEXT;
ALTER TABLE state_licenses ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE state_licenses ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE state_licenses ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE state_licenses ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE state_licenses ADD COLUMN IF NOT EXISTS specialties TEXT;
ALTER TABLE state_licenses ADD COLUMN IF NOT EXISTS service_areas TEXT;
ALTER TABLE state_licenses ADD COLUMN IF NOT EXISTS zillow_reviews_json JSONB;
ALTER TABLE state_licenses ADD COLUMN IF NOT EXISTS zillow_error TEXT;

-- Create index for efficient queue queries
CREATE INDEX IF NOT EXISTS idx_state_licenses_zillow_queue 
ON state_licenses (state, zillow_scraped_at) 
WHERE zillow_scraped_at IS NULL;