-- Drop existing function first (required when changing return type)
DROP FUNCTION IF EXISTS public.search_location(text);

-- Recreate search_location function with primary_zip in return type
-- This enables the 5-segment URL format: /:stateSlug/:citySlug/:zipCode/:neighborhoodSlug/:categorySlug

CREATE OR REPLACE FUNCTION public.search_location(search_term text)
 RETURNS TABLE(
   search_type text, 
   neighborhood_id uuid, 
   neighborhood text, 
   neighborhood_slug text, 
   city_area text, 
   city_area_slug text, 
   state text, 
   tier text, 
   median_home_value integer, 
   is_primary boolean, 
   match_score numeric,
   primary_zip text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_zip BOOLEAN;
  clean_term TEXT;
BEGIN
  clean_term := TRIM(search_term);
  is_zip := clean_term ~ '^\d{5}$';
  
  IF is_zip THEN
    -- ZIP code search: join to neighborhood_catalog to get primary_zip
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
      (100 - znl.value_rank)::NUMERIC as match_score,
      nc.primary_zip
    FROM zip_neighborhood_lookup znl
    LEFT JOIN neighborhood_catalog nc ON znl.id = nc.id
    WHERE znl.zip_code = clean_term
    ORDER BY znl.value_rank ASC
    LIMIT 20;
  ELSE
    -- Text search: primary_zip already available from neighborhood_catalog
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
      )::NUMERIC as match_score,
      nc.primary_zip
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
$function$;