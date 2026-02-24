-- Restrict search_location to cities/neighborhoods with at least one qualified agent (4.8+, 20+ reviews).
-- Prevents "geo misfire": search suggesting 0-agent areas and users landing on empty list pages.
-- Same qualification rule as generate-sitemap (Rule A).

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
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_term text;
  is_zip boolean;
BEGIN
  clean_term := lower(trim(search_term));
  is_zip := clean_term ~ '^\d{5}$';

  RETURN QUERY
  -- Cities: only those with at least one 4.8+ / 20+ review active professional
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
    AND EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.city_id = c.id
        AND p.active = true
        AND p.review_stars_rating >= 4.8
        AND p.num_total_reviews >= 20
    )

  UNION ALL

  -- Neighborhoods: only those with at least one qualified agent in neighborhood ZIPs
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
      WHEN is_zip AND nc.primary_zip = clean_term THEN 100
      WHEN is_zip AND clean_term = ANY(nc.zips) THEN 95
      WHEN lower(nc.neighborhood) = clean_term THEN 90
      WHEN lower(nc.neighborhood) LIKE clean_term || '%' THEN 80
      ELSE 70
    END as match_score,
    NULL::uuid as city_id
  FROM neighborhood_catalog nc
  WHERE nc.is_active = true
    AND nc.primary_zip IS NOT NULL
    AND nc.state IN ('Arizona', 'California')
    AND nc.zips IS NOT NULL
    AND array_length(nc.zips, 1) > 0
    AND nc.id IN (SELECT id FROM get_neighborhood_ids_with_qualified_agents())
    AND (
      (is_zip AND (nc.primary_zip = clean_term OR clean_term = ANY(nc.zips)))
      OR
      (NOT is_zip AND (
        lower(nc.neighborhood) LIKE '%' || clean_term || '%'
        OR lower(nc.city_area) LIKE '%' || clean_term || '%'
      ))
    )

  UNION ALL

  -- Neighborhood aliases: same qualified-neighborhood filter
  SELECT
    'neighborhood'::text as result_type,
    na.alias_name as neighborhood,
    nc.neighborhood_slug as neighborhood_slug,
    nc.city_area as city_area,
    nc.city_area_slug as city_area_slug,
    nc.primary_zip as primary_zip,
    nc.state as state,
    nc.tier as tier,
    nc.median_home_value::numeric as median_home_value,
    CASE
      WHEN lower(na.alias_name) = clean_term THEN 88
      WHEN lower(na.alias_name) LIKE clean_term || '%' THEN 78
      ELSE 68
    END as match_score,
    NULL::uuid as city_id
  FROM neighborhood_aliases na
  JOIN neighborhood_catalog nc ON na.neighborhood_id = nc.id
  WHERE nc.is_active = true
    AND nc.primary_zip IS NOT NULL
    AND nc.state IN ('Arizona', 'California')
    AND nc.zips IS NOT NULL
    AND array_length(nc.zips, 1) > 0
    AND nc.id IN (SELECT id FROM get_neighborhood_ids_with_qualified_agents())
    AND NOT is_zip
    AND lower(na.alias_name) LIKE '%' || clean_term || '%'

  ORDER BY match_score DESC, neighborhood
  LIMIT 20;
END;
$$;

COMMENT ON FUNCTION public.search_location(text) IS 'Search cities and neighborhoods by term or ZIP. Returns only regions with at least one qualified agent (4.8+ stars, 20+ reviews) to avoid geo misfire.';
