-- Report: Arizona cities and neighborhoods with 0 qualified agents (4.5+ stars, 10+ verified reviews in last 24 months).
-- Run in Supabase SQL Editor to see scope of "geo misfire" (empty list pages).
-- Qualification matches get_neighborhood_ids_with_qualified_agents and generate-sitemap Rule A.

-- 1) Arizona cities with 0 qualified agents (active cities only)
SELECT
  c.id,
  c.name,
  c.slug,
  c.state,
  (SELECT COUNT(*) FROM professionals p
   WHERE p.city_id = c.id AND p.active = true
     AND p.review_stars_rating >= 4.5 AND p.num_total_reviews >= 10) AS qualified_count
FROM cities c
WHERE c.active = true
  AND c.state = 'Arizona'
  AND NOT EXISTS (
    SELECT 1 FROM professionals p
    WHERE p.city_id = c.id AND p.active = true
      AND p.review_stars_rating >= 4.5 AND p.num_total_reviews >= 10
  )
ORDER BY c.name;

-- 2) Arizona neighborhoods with 0 qualified agents (active, has zips)
SELECT
  nc.id,
  nc.neighborhood,
  nc.neighborhood_slug,
  nc.city_area,
  nc.city_area_slug,
  nc.primary_zip
FROM neighborhood_catalog nc
WHERE nc.is_active = true
  AND nc.state = 'Arizona'
  AND nc.primary_zip IS NOT NULL
  AND nc.zips IS NOT NULL
  AND jsonb_array_length(to_jsonb(nc.zips)) > 0
  AND nc.id NOT IN (SELECT id FROM get_neighborhood_ids_with_qualified_agents())
ORDER BY nc.city_area_slug, nc.neighborhood_slug;

-- 3) Summary counts
SELECT
  (SELECT COUNT(*) FROM cities c
   WHERE c.active = true AND c.state = 'Arizona'
     AND NOT EXISTS (
       SELECT 1 FROM professionals p
       WHERE p.city_id = c.id AND p.active = true
         AND p.review_stars_rating >= 4.5 AND p.num_total_reviews >= 10
     )) AS az_cities_zero_qualified,
  (SELECT COUNT(*) FROM neighborhood_catalog nc
   WHERE nc.is_active = true AND nc.state = 'Arizona'
     AND nc.primary_zip IS NOT NULL AND nc.zips IS NOT NULL
     AND jsonb_array_length(to_jsonb(nc.zips)) > 0
     AND nc.id NOT IN (SELECT id FROM get_neighborhood_ids_with_qualified_agents())) AS az_neighborhoods_zero_qualified;
