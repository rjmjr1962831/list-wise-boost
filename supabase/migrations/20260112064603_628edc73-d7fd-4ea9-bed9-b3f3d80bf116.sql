-- Drop existing function to recreate with correct types
DROP FUNCTION IF EXISTS search_location(TEXT);

-- Recreate function with explicit type casting for median_home_value
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
  median_home_value INTEGER,
  is_primary BOOLEAN,
  match_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_zip BOOLEAN;
  clean_term TEXT;
BEGIN
  clean_term := TRIM(search_term);
  is_zip := clean_term ~ '^\d{5}$';
  
  IF is_zip THEN
    -- ZIP code search using the view
    RETURN QUERY
    SELECT 
      'zip'::TEXT as search_type,
      znl.id as neighborhood_id,
      znl.neighborhood,
      znl.neighborhood_slug,
      znl.city_area,
      znl.city_area_slug,
      znl.state,
      znl.tier,
      znl.median_home_value::INTEGER,
      (znl.value_rank = 1) as is_primary,
      (100 - znl.value_rank)::NUMERIC as match_score
    FROM zip_neighborhood_lookup znl
    WHERE znl.zip_code = clean_term
    ORDER BY znl.value_rank ASC
    LIMIT 20;
  ELSE
    -- Text search with fuzzy matching
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
      nc.median_home_value::INTEGER,
      FALSE as is_primary,
      GREATEST(
        similarity(LOWER(nc.neighborhood), LOWER(clean_term)),
        similarity(LOWER(nc.city_area), LOWER(clean_term))
      )::NUMERIC as match_score
    FROM neighborhood_catalog nc
    WHERE nc.is_active = true
      AND (
        nc.neighborhood ILIKE '%' || clean_term || '%'
        OR nc.city_area ILIKE '%' || clean_term || '%'
      )
    ORDER BY match_score DESC, nc.median_home_value DESC NULLS LAST
    LIMIT 20;
  END IF;
END;
$$;