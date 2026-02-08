-- Create function to aggregate bot statistics
CREATE OR REPLACE FUNCTION get_bot_stats(start_date timestamptz)
RETURNS TABLE (
  bot_type text,
  total_visits bigint,
  cache_hits bigint,
  cache_misses bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(crl.bot_type, 'unknown')::text as bot_type,
    COUNT(*)::bigint as total_visits,
    COUNT(*) FILTER (WHERE crl.cache_status = 'HIT')::bigint as cache_hits,
    COUNT(*) FILTER (WHERE crl.cache_status = 'MISS')::bigint as cache_misses
  FROM cloudflare_request_logs crl
  WHERE crl.is_bot = true
    AND crl.timestamp >= start_date
  GROUP BY crl.bot_type
  ORDER BY total_visits DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_bot_stats(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_bot_stats(timestamptz) TO anon;
