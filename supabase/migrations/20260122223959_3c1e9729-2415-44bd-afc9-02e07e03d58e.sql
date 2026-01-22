-- Add unique constraint for upsert operations
ALTER TABLE neighborhood_catalog 
ADD CONSTRAINT neighborhood_catalog_unique_key 
UNIQUE (state, city_area_slug, neighborhood_slug);