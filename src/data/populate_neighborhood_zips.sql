-- Populate neighborhood_zips table with Arizona ZIP mappings
-- This assumes neighborhoods already exist in neighborhood_catalog
-- Run this AFTER creating the neighborhood_zips table

-- First, let's see what neighborhoods exist
-- (You'll need to match these with the INSERT statements below)

-- Arcadia (Phoenix)
INSERT INTO neighborhood_zips (neighborhood_id, zip_code)
SELECT id, zip 
FROM neighborhood_catalog, unnest(ARRAY['85018', '85016']) AS zip
WHERE slug = 'arcadia' AND city_id IN (SELECT id FROM cities WHERE name = 'Phoenix')
ON CONFLICT (neighborhood_id, zip_code) DO NOTHING;

-- Camelback East (Phoenix)
INSERT INTO neighborhood_zips (neighborhood_id, zip_code)
SELECT id, zip
FROM neighborhood_catalog, unnest(ARRAY['85018', '85016']) AS zip
WHERE slug = 'camelback-east' AND city_id IN (SELECT id FROM cities WHERE name = 'Phoenix')
ON CONFLICT (neighborhood_id, zip_code) DO NOTHING;

-- Biltmore (Phoenix)
INSERT INTO neighborhood_zips (neighborhood_id, zip_code)
SELECT id, zip
FROM neighborhood_catalog, unnest(ARRAY['85016', '85018']) AS zip
WHERE slug = 'biltmore' AND city_id IN (SELECT id FROM cities WHERE name = 'Phoenix')
ON CONFLICT (neighborhood_id, zip_code) DO NOTHING;

-- North Central Phoenix
INSERT INTO neighborhood_zips (neighborhood_id, zip_code)
SELECT id, zip
FROM neighborhood_catalog, unnest(ARRAY['85020', '85021', '85022']) AS zip
WHERE slug = 'north-central' AND city_id IN (SELECT id FROM cities WHERE name = 'Phoenix')
ON CONFLICT (neighborhood_id, zip_code) DO NOTHING;

-- Desert Ridge (Phoenix)
INSERT INTO neighborhood_zips (neighborhood_id, zip_code)
SELECT id, zip
FROM neighborhood_catalog, unnest(ARRAY['85050', '85054']) AS zip
WHERE slug = 'desert-ridge' AND city_id IN (SELECT id FROM cities WHERE name = 'Phoenix')
ON CONFLICT (neighborhood_id, zip_code) DO NOTHING;

-- Anthem (Phoenix)
INSERT INTO neighborhood_zips (neighborhood_id, zip_code)
SELECT id, zip
FROM neighborhood_catalog, unnest(ARRAY['85086']) AS zip
WHERE slug = 'anthem' AND city_id IN (SELECT id FROM cities WHERE name = 'Phoenix')
ON CONFLICT (neighborhood_id, zip_code) DO NOTHING;

-- Ahwatukee (Phoenix)
INSERT INTO neighborhood_zips (neighborhood_id, zip_code)
SELECT id, zip
FROM neighborhood_catalog, unnest(ARRAY['85044', '85048']) AS zip
WHERE slug = 'ahwatukee' AND city_id IN (SELECT id FROM cities WHERE name = 'Phoenix')
ON CONFLICT (neighborhood_id, zip_code) DO NOTHING;

-- Old Town Scottsdale
INSERT INTO neighborhood_zips (neighborhood_id, zip_code)
SELECT id, zip
FROM neighborhood_catalog, unnest(ARRAY['85251', '85257']) AS zip
WHERE slug = 'old-town' AND city_id IN (SELECT id FROM cities WHERE name = 'Scottsdale')
ON CONFLICT (neighborhood_id, zip_code) DO NOTHING;

-- North Scottsdale
INSERT INTO neighborhood_zips (neighborhood_id, zip_code)
SELECT id, zip
FROM neighborhood_catalog, unnest(ARRAY['85255', '85258', '85259', '85260', '85262']) AS zip
WHERE slug = 'north-scottsdale' AND city_id IN (SELECT id FROM cities WHERE name = 'Scottsdale')
ON CONFLICT (neighborhood_id, zip_code) DO NOTHING;

-- DC Ranch (Scottsdale)
INSERT INTO neighborhood_zips (neighborhood_id, zip_code)
SELECT id, zip
FROM neighborhood_catalog, unnest(ARRAY['85255', '85262']) AS zip
WHERE slug = 'dc-ranch' AND city_id IN (SELECT id FROM cities WHERE name = 'Scottsdale')
ON CONFLICT (neighborhood_id, zip_code) DO NOTHING;

-- Paradise Valley
INSERT INTO neighborhood_zips (neighborhood_id, zip_code)
SELECT id, zip
FROM neighborhood_catalog, unnest(ARRAY['85253', '85254']) AS zip
WHERE city_id IN (SELECT id FROM cities WHERE name = 'Paradise Valley')
ON CONFLICT (neighborhood_id, zip_code) DO NOTHING;

-- Downtown Tempe
INSERT INTO neighborhood_zips (neighborhood_id, zip_code)
SELECT id, zip
FROM neighborhood_catalog, unnest(ARRAY['85281', '85282']) AS zip
WHERE slug = 'downtown' AND city_id IN (SELECT id FROM cities WHERE name = 'Tempe')
ON CONFLICT (neighborhood_id, zip_code) DO NOTHING;

-- East Mesa
INSERT INTO neighborhood_zips (neighborhood_id, zip_code)
SELECT id, zip
FROM neighborhood_catalog, unnest(ARRAY['85205', '85206', '85207']) AS zip
WHERE slug = 'east-mesa' AND city_id IN (SELECT id FROM cities WHERE name = 'Mesa')
ON CONFLICT (neighborhood_id, zip_code) DO NOTHING;

-- Downtown Chandler
INSERT INTO neighborhood_zips (neighborhood_id, zip_code)
SELECT id, zip
FROM neighborhood_catalog, unnest(ARRAY['85224', '85225']) AS zip
WHERE slug = 'downtown' AND city_id IN (SELECT id FROM cities WHERE name = 'Chandler')
ON CONFLICT (neighborhood_id, zip_code) DO NOTHING;

-- South Chandler
INSERT INTO neighborhood_zips (neighborhood_id, zip_code)
SELECT id, zip
FROM neighborhood_catalog, unnest(ARRAY['85248', '85249']) AS zip
WHERE slug = 'south-chandler' AND city_id IN (SELECT id FROM cities WHERE name = 'Chandler')
ON CONFLICT (neighborhood_id, zip_code) DO NOTHING;

-- Gilbert Heritage District
INSERT INTO neighborhood_zips (neighborhood_id, zip_code)
SELECT id, zip
FROM neighborhood_catalog, unnest(ARRAY['85233', '85234']) AS zip
WHERE slug = 'heritage-district' AND city_id IN (SELECT id FROM cities WHERE name = 'Gilbert')
ON CONFLICT (neighborhood_id, zip_code) DO NOTHING;

-- Power Ranch (Gilbert)
INSERT INTO neighborhood_zips (neighborhood_id, zip_code)
SELECT id, zip
FROM neighborhood_catalog, unnest(ARRAY['85297']) AS zip
WHERE slug = 'power-ranch' AND city_id IN (SELECT id FROM cities WHERE name = 'Gilbert')
ON CONFLICT (neighborhood_id, zip_code) DO NOTHING;

-- Arrowhead (Glendale)
INSERT INTO neighborhood_zips (neighborhood_id, zip_code)
SELECT id, zip
FROM neighborhood_catalog, unnest(ARRAY['85308', '85310']) AS zip
WHERE slug = 'arrowhead' AND city_id IN (SELECT id FROM cities WHERE name = 'Glendale')
ON CONFLICT (neighborhood_id, zip_code) DO NOTHING;

-- Vistancia (Peoria)
INSERT INTO neighborhood_zips (neighborhood_id, zip_code)
SELECT id, zip
FROM neighborhood_catalog, unnest(ARRAY['85383']) AS zip
WHERE slug = 'vistancia' AND city_id IN (SELECT id FROM cities WHERE name = 'Peoria')
ON CONFLICT (neighborhood_id, zip_code) DO NOTHING;

-- Show statistics
SELECT 
    COUNT(*) as total_mappings,
    COUNT(DISTINCT neighborhood_id) as neighborhoods_mapped,
    COUNT(DISTINCT zip_code) as unique_zips
FROM neighborhood_zips;

-- Show neighborhoods with their ZIP counts
SELECT 
    c.name as city,
    nc.name as neighborhood,
    array_agg(nz.zip_code ORDER BY nz.zip_code) as zip_codes,
    COUNT(nz.zip_code) as zip_count
FROM neighborhood_zips nz
JOIN neighborhood_catalog nc ON nz.neighborhood_id = nc.id
JOIN cities c ON nc.city_id = c.id
GROUP BY c.name, nc.name
ORDER BY c.name, nc.name;
