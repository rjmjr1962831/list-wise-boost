-- Bot crawl stats: rolling 30-day view + daily rollup into agent_bot_visit_summary
-- Applied via run-ddl on 2026-03-15

-- View: agent_bot_crawl_stats (rolling 30-day window from bot_crawl_logs)
CREATE OR REPLACE VIEW agent_bot_crawl_stats AS
SELECT
  agent_id,
  count(*)::int as total_crawls_30d,
  count(*) FILTER (WHERE page_path LIKE '%/agents/%')::int as profile_crawls_30d,
  count(*) FILTER (WHERE page_path NOT LIKE '%/agents/%')::int as list_crawls_30d,
  count(DISTINCT bot_name)::int as unique_bot_count_30d,
  array_agg(DISTINCT bot_name ORDER BY bot_name) as bot_names_30d,
  max(crawled_at) as last_crawled_at
FROM bot_crawl_logs
WHERE agent_id IS NOT NULL
  AND crawled_at >= now() - INTERVAL '30 days'
GROUP BY agent_id;

-- Function: daily rollup into agent_bot_visit_summary
CREATE OR REPLACE FUNCTION rollup_bot_crawl_daily()
RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE affected int;
BEGIN
  INSERT INTO agent_bot_visit_summary (agent_id, date, total_bot_visits, profile_visits, unique_bots, visits_by_bot_type)
  SELECT
    agent_id,
    CURRENT_DATE,
    count(*)::int,
    count(*) FILTER (WHERE page_path LIKE '%/agents/%')::int,
    array_agg(DISTINCT bot_name ORDER BY bot_name),
    (SELECT jsonb_object_agg(bn, cnt) FROM (
      SELECT bot_name AS bn, count(*)::int AS cnt
      FROM bot_crawl_logs b2
      WHERE b2.agent_id = b1.agent_id AND b2.crawled_at >= now() - INTERVAL '30 days'
      GROUP BY bot_name
    ) sub)
  FROM bot_crawl_logs b1
  WHERE agent_id IS NOT NULL
    AND crawled_at >= now() - INTERVAL '30 days'
  GROUP BY agent_id
  ON CONFLICT (agent_id, date) DO UPDATE SET
    total_bot_visits = EXCLUDED.total_bot_visits,
    profile_visits = EXCLUDED.profile_visits,
    unique_bots = EXCLUDED.unique_bots,
    visits_by_bot_type = EXCLUDED.visits_by_bot_type,
    updated_at = now();

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- Cron: run daily at 4am UTC
SELECT cron.schedule('rollup-bot-crawl-daily', '0 4 * * *', 'SELECT rollup_bot_crawl_daily()');
