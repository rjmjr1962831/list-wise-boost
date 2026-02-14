-- SOT Audit / Rule A: Neighborhoods with at least one 4.8+ qualified agent (20+ reviews)
-- Used by generate-sitemap Edge Function to exclude "Empty Merit Gaps" from sitemap.
CREATE OR REPLACE FUNCTION get_neighborhood_ids_with_qualified_agents()
RETURNS TABLE(id uuid) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT nc.id
  FROM neighborhood_catalog nc
  WHERE nc.is_active = true
    AND nc.primary_zip IS NOT NULL
    AND nc.state IN ('Arizona', 'California')
    AND nc.zips IS NOT NULL
    AND array_length(nc.zips, 1) > 0
    AND EXISTS (
      SELECT 1
      FROM agent_zip_activity aza
      JOIN professionals p ON aza.license_number = p.license_number
      WHERE aza.zip_code = ANY(nc.zips)
        AND p.active = true
        AND p.review_stars_rating >= 4.8
        AND p.num_total_reviews >= 20
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_neighborhood_ids_with_qualified_agents IS 'Returns neighborhood_catalog.id for neighborhoods with at least one 4.8+ star, 20+ review agent (for sitemap Rule A filter)';
