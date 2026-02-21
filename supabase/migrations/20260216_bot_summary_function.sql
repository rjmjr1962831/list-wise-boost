-- get_bot_summary: same MAIN host filter as get_bot_stats so dashboard summary and table match.
-- Fixes summary showing 0 when logs have host NULL but url contains www.top10lists.us.

CREATE OR REPLACE FUNCTION get_bot_summary(start_date timestamptz)
RETURNS TABLE (
  total_bot_visits bigint,
  unique_bots bigint,
  unique_agents_viewed bigint,
  cache_hit_rate numeric
) AS $$
DECLARE
  main_filter boolean;
BEGIN
  RETURN QUERY
  WITH main_logs AS (
    SELECT crl.path, crl.bot_type, crl.cache_status
    FROM cloudflare_request_logs crl
    WHERE crl.is_bot = true
      AND crl.timestamp >= start_date
      AND (crl.host = 'www.top10lists.us' OR (crl.host IS NULL AND crl.url ILIKE '%www.top10lists.us%'))
  ),
  agent_slugs AS (
    SELECT DISTINCT
      COALESCE(
        (regexp_match(path, '/[^/]+/agents/([^/?#]+)'))[1],
        (regexp_match(path, '/[^/]+/[^/]+/top10realestateagents/([^/?#]+)'))[1]
      ) AS slug
    FROM main_logs
    WHERE path ~ '/[^/]+/agents/[^/?#]+' OR path ~ '/[^/]+/[^/]+/top10realestateagents/[^/?#]+'
  ),
  valid_slugs AS (
    SELECT slug FROM agent_slugs
    WHERE slug IS NOT NULL
      AND slug != 'top10realestateagents'
      AND slug !~ '^\d{5}$'
  )
  SELECT
    (SELECT count(*)::bigint FROM main_logs),
    (SELECT count(DISTINCT bot_type)::bigint FROM main_logs),
    (SELECT count(*)::bigint FROM valid_slugs),
    COALESCE((SELECT round(100.0 * count(*) FILTER (WHERE cache_status = 'HIT') / nullif(count(*), 0), 2) FROM main_logs), 0)::numeric;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_bot_summary(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_bot_summary(timestamptz) TO anon;

COMMENT ON FUNCTION get_bot_summary(timestamptz) IS 'Summary stats for Bot Analytics Dashboard; MAIN (www) only, same filter as get_bot_stats';
