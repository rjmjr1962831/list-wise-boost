-- Audit neighborhood zip codes for corruption
-- Checking if 128+ neighborhoods incorrectly have primary_zip = "85033"

-- 1. Count neighborhoods with 85033 (should be minimal, it's Downtown Phoenix)
SELECT 
    COUNT(*) as total_with_85033,
    COUNT(DISTINCT city_area_slug) as affected_cities
FROM neighborhood_catalog
WHERE primary_zip = '85033';

-- 2. List all neighborhoods with 85033 to see if they're obviously wrong
SELECT 
    neighborhood,
    city_area AS city,
    city_area_slug,
    neighborhood_slug,
    primary_zip,
    state,
    lat,
    lon
FROM neighborhood_catalog
WHERE primary_zip = '85033'
ORDER BY city_area, neighborhood
LIMIT 50;

-- 3. Check Grayhawk vs Greyhawk duplicates
SELECT 
    neighborhood,
    city_area_slug,
    neighborhood_slug,
    primary_zip,
    zips,
    lat,
    lon,
    is_active,
    source
FROM neighborhood_catalog
WHERE neighborhood ILIKE '%gray%hawk%' OR neighborhood_slug ILIKE '%gray%hawk%'
ORDER BY neighborhood;

-- 4. Check specific Scottsdale neighborhoods mentioned
SELECT 
    neighborhood,
    city_area_slug,
    neighborhood_slug,
    primary_zip,
    zips,
    lat,
    lon,
    source,
    created_at
FROM neighborhood_catalog
WHERE city_area_slug = 'scottsdale' 
  AND neighborhood IN ('Grayhawk', 'Greyhawk', 'The Boulders', 'Scottsdale Ranch')
ORDER BY neighborhood;

-- 5. Check for neighborhoods from Redfin import on 2026-01-26
SELECT 
    source,
    COUNT(*) as total,
    COUNT(CASE WHEN primary_zip = '85033' THEN 1 END) as with_85033,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created
FROM neighborhood_catalog
WHERE DATE(created_at) >= '2026-01-26'
GROUP BY source
ORDER BY total DESC;

-- 6. Check Beverly Hills existence
SELECT 
    neighborhood,
    city_area_slug,
    neighborhood_slug,
    primary_zip,
    state
FROM neighborhood_catalog
WHERE neighborhood ILIKE '%beverly%hills%' OR neighborhood_slug ILIKE '%beverly%hills%';
