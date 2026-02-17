-- Add host column so we can report bot analytics from MAIN (www.top10lists.us) only.
-- Staging has no crawl / noindex; cache hits should be from production.

ALTER TABLE public.cloudflare_request_logs
  ADD COLUMN IF NOT EXISTS host text;

COMMENT ON COLUMN public.cloudflare_request_logs.host IS 'Request host from Cloudflare ClientRequestHost (e.g. www.top10lists.us, staging.top10lists.us)';

-- Backfill from raw_log where possible
UPDATE public.cloudflare_request_logs
SET host = raw_log->>'ClientRequestHost'
WHERE host IS NULL AND raw_log IS NOT NULL;

-- get_bot_stats: only MAIN (www.top10lists.us)
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
    AND (crl.host = 'www.top10lists.us' OR (crl.host IS NULL AND crl.url ILIKE '%www.top10lists.us%'))
  GROUP BY crl.bot_type
  ORDER BY total_visits DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_bot_stats(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_bot_stats(timestamptz) TO anon;
