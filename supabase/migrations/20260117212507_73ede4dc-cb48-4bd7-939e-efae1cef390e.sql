-- Fix the search_location function with proper type casting for cities
DROP FUNCTION IF EXISTS public.search_location(text);

CREATE OR REPLACE FUNCTION public.search_location(search_term text)
RETURNS TABLE(
  result_type text,
  neighborhood text,
  neighborhood_slug text,
  city_area text,
  city_area_slug text,
  primary_zip text,
  state text,
  tier text,
  median_home_value numeric,
  match_score integer,
  city_id uuid
) 
LANGUAGE plpgsql
AS $$
DECLARE
  clean_term text;
  is_zip boolean;
BEGIN
  -- Clean and prepare search term
  clean_term := lower(trim(search_term));
  is_zip := clean_term ~ '^\d{5}$';
  
  RETURN QUERY
  -- Cities first (priority 1)
  SELECT 
    'city'::text as result_type,
    c.name as neighborhood,
    c.slug as neighborhood_slug,
    c.name as city_area,
    c.slug as city_area_slug,
    ''::text as primary_zip,
    c.state as state,
    'city'::text as tier,
    0::numeric as median_home_value,
    CASE 
      WHEN lower(c.name) = clean_term THEN 100
      WHEN lower(c.name) LIKE clean_term || '%' THEN 90
      ELSE 80
    END as match_score,
    c.id as city_id
  FROM cities c
  WHERE c.active = true
    AND c.state = 'Arizona'
    AND (
      lower(c.name) LIKE '%' || clean_term || '%'
      OR lower(c.slug) LIKE '%' || clean_term || '%'
    )
  
  UNION ALL
  
  -- Neighborhoods (priority 2)
  SELECT 
    'neighborhood'::text as result_type,
    nc.neighborhood as neighborhood,
    nc.neighborhood_slug as neighborhood_slug,
    nc.city_area as city_area,
    nc.city_area_slug as city_area_slug,
    nc.primary_zip as primary_zip,
    nc.state as state,
    nc.tier as tier,
    nc.median_home_value::numeric as median_home_value,
    CASE 
      -- Exact ZIP match gets highest score
      WHEN is_zip AND nc.primary_zip = clean_term THEN 100
      WHEN is_zip AND clean_term = ANY(nc.zips) THEN 95
      -- Exact neighborhood name match
      WHEN lower(nc.neighborhood) = clean_term THEN 90
      -- Starts with search term
      WHEN lower(nc.neighborhood) LIKE clean_term || '%' THEN 80
      -- Contains search term
      ELSE 70
    END as match_score,
    NULL::uuid as city_id
  FROM neighborhood_catalog nc
  WHERE nc.is_active = true
    AND nc.primary_zip IS NOT NULL
    AND (
      -- ZIP code search
      (is_zip AND (nc.primary_zip = clean_term OR clean_term = ANY(nc.zips)))
      OR
      -- Text search on neighborhood or city
      (NOT is_zip AND (
        lower(nc.neighborhood) LIKE '%' || clean_term || '%'
        OR lower(nc.city_area) LIKE '%' || clean_term || '%'
      ))
    )
  
  ORDER BY match_score DESC, neighborhood
  LIMIT 20;
END;
$$;