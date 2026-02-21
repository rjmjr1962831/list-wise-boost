-- RPC for badge API: return neighborhoods with transaction counts for an agent (underwritten tier)
CREATE OR REPLACE FUNCTION get_agent_neighborhoods_with_transactions(p_license_number TEXT, p_state TEXT)
RETURNS TABLE (
  neighborhood_name TEXT,
  neighborhood_slug TEXT,
  city_slug TEXT,
  state_slug TEXT,
  transaction_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    nc.neighborhood::TEXT AS neighborhood_name,
    nc.neighborhood_slug::TEXT AS neighborhood_slug,
    nc.city_area_slug::TEXT AS city_slug,
    LOWER(REPLACE(nc.state, ' ', '-'))::TEXT AS state_slug,
    SUM(aza.transaction_count)::BIGINT AS transaction_count
  FROM agent_zip_activity aza
  JOIN neighborhood_catalog nc ON aza.zip_code = ANY(nc.zips)
  WHERE aza.license_number = p_license_number
    AND aza.state = p_state
    AND (nc.is_active = true OR nc.is_active IS NULL)
  GROUP BY nc.id, nc.neighborhood, nc.neighborhood_slug, nc.city_area_slug, nc.state
  HAVING SUM(aza.transaction_count) >= 2
  ORDER BY transaction_count DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_agent_neighborhoods_with_transactions IS 'Returns neighborhoods with verified transaction counts for badge API (underwritten tier only)';
