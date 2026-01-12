-- Migration: Fix ZIP Lookup View
-- Created: 2026-01-12
-- Purpose: Apply correct CROSS JOIN LATERAL pattern for array explosion

DROP VIEW IF EXISTS zip_neighborhood_lookup;

CREATE VIEW zip_neighborhood_lookup AS
SELECT 
  nc.id,
  nc.state,
  nc.city_area,
  nc.city_area_slug,
  nc.neighborhood,
  nc.neighborhood_slug,
  nc.tier,
  nc.median_home_value,
  zip_code,
  ROW_NUMBER() OVER (
    PARTITION BY zip_code 
    ORDER BY nc.median_home_value DESC NULLS LAST
  ) AS value_rank
FROM neighborhood_catalog nc
CROSS JOIN LATERAL unnest(nc.zips) AS zip_code
WHERE nc.is_active = true
  AND nc.zips IS NOT NULL
  AND array_length(nc.zips, 1) > 0;

COMMENT ON VIEW zip_neighborhood_lookup IS 'Maps ZIP codes to neighborhoods with value-based ranking. Uses CROSS JOIN LATERAL for proper array explosion.';