-- Migration: ZIP-to-Neighborhood Search System
-- Purpose: Enable unified search by ZIP code or neighborhood name

-- =============================================================================
-- PART 1: ZIP Lookup View
-- =============================================================================
-- Creates a view that explodes the zips array from neighborhood_catalog
-- Each row represents one ZIP code mapped to one neighborhood
-- Ranks neighborhoods by median_home_value to determine "primary" for each ZIP

CREATE OR REPLACE VIEW zip_neighborhood_lookup AS
SELECT 
  nc.id,
  nc.state,
  nc.city_area,
  nc.city_area_slug,
  nc.neighborhood,
  nc.neighborhood_slug,
  nc.tier,
  nc.median_home_value,
  unnest(nc.zips) AS zip_code,
  ROW_NUMBER() OVER (
    PARTITION BY unnest(nc.zips) 
    ORDER BY nc.median_home_value DESC NULLS LAST
  ) AS value_rank
FROM neighborhood_catalog nc
WHERE nc.is_active = true
  AND nc.zips IS NOT NULL
  AND array_length(nc.zips, 1) > 0;

COMMENT ON VIEW zip_neighborhood_lookup IS 'Maps ZIP codes to neighborhoods with value-based ranking for determining primary neighborhood per ZIP';

-- =============================================================================
-- PART 2: Universal Search Function
-- =============================================================================
-- Accepts either a 5-digit ZIP code or text search term
-- Returns neighborhoods with ranking and primary flag

CREATE OR REPLACE FUNCTION search_location(search_term TEXT)
RETURNS TABLE (
  search_type TEXT,
  neighborhood_id UUID,
  neighborhood TEXT,
  neighborhood_slug TEXT,
  city_area TEXT,
  city_area_slug TEXT,
  state TEXT,
  tier TEXT,
  median_home_value BIGINT,
  is_primary BOOLEAN,
  match_score INTEGER
) AS $$
BEGIN
  -- Detect if input is a 5-digit ZIP code
  IF search_term ~ '^\d{5}$' THEN
    -- ZIP code search
    RETURN QUERY
    SELECT 
      'zip'::TEXT as search_type,
      z.id as neighborhood_id,
      z.neighborhood,
      z.neighborhood_slug,
      z.city_area,
      z.city_area_slug,
      z.state,
      z.tier,
      z.median_home_value,
      (z.value_rank = 1) as is_primary,
      1 as match_score
    FROM zip_neighborhood_lookup z
    WHERE z.zip_code = search_term
    ORDER BY z.value_rank;
    
  ELSE
    -- Text search for neighborhood or city_area
    RETURN QUERY
    SELECT 
      'text'::TEXT as search_type,
      nc.id as neighborhood_id,
      nc.neighborhood,
      nc.neighborhood_slug,
      nc.city_area,
      nc.city_area_slug,
      nc.state,
      nc.tier,
      nc.median_home_value,
      FALSE as is_primary,
      CASE 
        -- Exact neighborhood match (highest priority)
        WHEN LOWER(nc.neighborhood) = LOWER(search_term) THEN 100
        -- Neighborhood starts with search term
        WHEN LOWER(nc.neighborhood) LIKE LOWER(search_term) || '%' THEN 90
        -- Exact city match
        WHEN LOWER(nc.city_area) = LOWER(search_term) THEN 80
        -- City starts with search term
        WHEN LOWER(nc.city_area) LIKE LOWER(search_term) || '%' THEN 70
        -- Neighborhood contains search term
        WHEN LOWER(nc.neighborhood) LIKE '%' || LOWER(search_term) || '%' THEN 50
        -- City contains search term
        WHEN LOWER(nc.city_area) LIKE '%' || LOWER(search_term) || '%' THEN 40
        -- Fallback
        ELSE 10
      END as match_score
    FROM neighborhood_catalog nc
    WHERE nc.is_active = true
      AND (
        LOWER(nc.neighborhood) LIKE '%' || LOWER(search_term) || '%'
        OR LOWER(nc.city_area) LIKE '%' || LOWER(search_term) || '%'
      )
    ORDER BY 
      match_score DESC, 
      nc.median_home_value DESC NULLS LAST
    LIMIT 20;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_location(TEXT) IS 'Universal search function that accepts ZIP codes or text. Returns ranked neighborhoods with primary flag for ZIPs.';