-- Add new columns for Zillow data tracking
ALTER TABLE neighborhood_catalog 
ADD COLUMN IF NOT EXISTS zillow_region_id text,
ADD COLUMN IF NOT EXISTS county text,
ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- Backfill existing records - set OSM records (from California ingestion) to 'osm'
UPDATE neighborhood_catalog 
SET source = 'osm' 
WHERE source IS NULL OR source = 'manual';

-- Create index on source for efficient filtering
CREATE INDEX IF NOT EXISTS idx_neighborhood_catalog_source ON neighborhood_catalog(source);