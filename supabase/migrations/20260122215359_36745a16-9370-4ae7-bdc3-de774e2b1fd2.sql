-- Add lat/lon columns to cities table for geocoding
ALTER TABLE cities 
ADD COLUMN IF NOT EXISTS lat NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS lon NUMERIC(11, 7);

COMMENT ON COLUMN cities.lat IS 'Latitude from Census Bureau gazetteer';
COMMENT ON COLUMN cities.lon IS 'Longitude from Census Bureau gazetteer';

-- Add index for geographic queries
CREATE INDEX IF NOT EXISTS idx_cities_coordinates ON cities(lat, lon) WHERE lat IS NOT NULL AND lon IS NOT NULL;