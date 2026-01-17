
-- Drop existing function and recreate with new return type
DROP FUNCTION IF EXISTS search_location(text);

-- Recreate search_location function to include city search
CREATE OR REPLACE FUNCTION search_location(search_term text)
RETURNS TABLE (
  search_type text,
  result_type text,
  neighborhood_id uuid,
  neighborhood text,
  neighborhood_slug text,
  city_area text,
  city_area_slug text,
  state text,
  tier text,
  median_home_value numeric,
  is_primary boolean,
  match_score integer,
  primary_zip text,
  city_id uuid
) 
LANGUAGE plpgsql
AS $$
DECLARE
  is_zip boolean;
  clean_term text;
BEGIN
  clean_term := TRIM(search_term);
  is_zip := clean_term ~ '^\d{5}$';
  
  IF is_zip THEN
    -- ZIP code search - neighborhoods only
    RETURN QUERY
    SELECT 
      'zip'::text as search_type,
      'neighborhood'::text as result_type,
      nc.id as neighborhood_id,
      nc.neighborhood,
      nc.neighborhood_slug,
      nc.city_area,
      nc.city_area_slug,
      nc.state,
      nc.tier,
      nc.median_home_value,
      (nc.primary_zip = clean_term) as is_primary,
      CASE 
        WHEN nc.primary_zip = clean_term THEN 100
        ELSE 50
      END as match_score,
      nc.primary_zip,
      NULL::uuid as city_id
    FROM neighborhood_catalog nc
    WHERE nc.is_active = true
      AND (nc.primary_zip = clean_term OR clean_term = ANY(nc.zips))
    ORDER BY 
      (nc.primary_zip = clean_term) DESC,
      nc.median_home_value DESC NULLS LAST
    LIMIT 20;
  ELSE
    -- Text search - search both neighborhoods AND cities
    RETURN QUERY
    -- First, get city matches
    SELECT 
      'text'::text as search_type,
      'city'::text as result_type,
      c.id as neighborhood_id,
      c.name as neighborhood,
      c.slug as neighborhood_slug,
      c.name as city_area,
      c.slug as city_area_slug,
      c.state,
      'city'::text as tier,
      NULL::numeric as median_home_value,
      true as is_primary,
      100 as match_score,
      NULL::text as primary_zip,
      c.id as city_id
    FROM cities c
    WHERE c.active = true
      AND c.state = 'Arizona'
      AND (
        c.name ILIKE clean_term || '%'
        OR c.name ILIKE '%' || clean_term || '%'
      )
    
    UNION ALL
    
    -- Then, get neighborhood matches
    SELECT 
      'text'::text as search_type,
      'neighborhood'::text as result_type,
      nc.id as neighborhood_id,
      nc.neighborhood,
      nc.neighborhood_slug,
      nc.city_area,
      nc.city_area_slug,
      nc.state,
      nc.tier,
      nc.median_home_value,
      false as is_primary,
      CASE 
        WHEN nc.neighborhood ILIKE clean_term || '%' THEN 90
        WHEN nc.neighborhood ILIKE '%' || clean_term || '%' THEN 70
        WHEN nc.city_area ILIKE clean_term || '%' THEN 60
        ELSE 50
      END as match_score,
      nc.primary_zip,
      NULL::uuid as city_id
    FROM neighborhood_catalog nc
    WHERE nc.is_active = true
      AND (
        nc.neighborhood ILIKE '%' || clean_term || '%'
        OR nc.city_area ILIKE '%' || clean_term || '%'
      )
    
    ORDER BY 
      result_type ASC,
      match_score DESC,
      neighborhood ASC
    LIMIT 20;
  END IF;
END;
$$;
