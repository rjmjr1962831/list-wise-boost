-- Add primary_zip column to neighborhood_catalog for deterministic canonical URLs
ALTER TABLE neighborhood_catalog ADD COLUMN IF NOT EXISTS primary_zip TEXT;

-- Populate primary_zip from first element of zips array
UPDATE neighborhood_catalog 
SET primary_zip = zips[1] 
WHERE zips IS NOT NULL AND array_length(zips, 1) > 0 AND primary_zip IS NULL;

-- Add index for efficient lookups by primary_zip
CREATE INDEX IF NOT EXISTS idx_neighborhood_catalog_primary_zip ON neighborhood_catalog(primary_zip);

-- Add comment documenting the column purpose
COMMENT ON COLUMN neighborhood_catalog.primary_zip IS 'The primary ZIP code used in canonical URLs. Populated from first element of zips array.';