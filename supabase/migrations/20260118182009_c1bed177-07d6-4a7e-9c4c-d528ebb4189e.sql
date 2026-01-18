ALTER TABLE neighborhood_catalog 
ADD COLUMN IF NOT EXISTS nearby_neighborhoods JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN neighborhood_catalog.nearby_neighborhoods IS 'Array of nearby neighborhoods within 2 miles, computed on demand';