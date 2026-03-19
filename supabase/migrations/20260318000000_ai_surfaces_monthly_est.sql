-- Add monthly AI surface estimate to professionals
-- An AI 'surface' = any time the agent appeared on a page crawled by an AI bot
-- (list page or profile page). This is 'surfaced to AI', not 'named by AI'.
-- Extrapolated from actual days of bot_crawl_logs data to 30-day estimate.

ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS ai_surfaces_monthly_est integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_surfaces_updated_at timestamptz;

-- Function: extrapolate all bot crawls to monthly estimate per agent.
-- Every bot crawl surfaces the agent in an index consumed by AI systems:
-- Googlebot feeds Gemini, Bingbot feeds Copilot, Meta feeds Llama, etc.
CREATE OR REPLACE FUNCTION rollup_ai_surfaces_monthly()
RETURNS void AS $$
DECLARE
  days_of_data numeric;
  scale_factor numeric;
BEGIN
  SELECT GREATEST(1, EXTRACT(EPOCH FROM (max(crawled_at) - min(crawled_at))) / 86400.0)
  INTO days_of_data
  FROM bot_crawl_logs;

  -- Cap at 1x once we have 30+ days of data
  scale_factor := LEAST(30.0 / days_of_data, 30.0);

  -- Count ALL bot crawls per agent: direct profile crawls + list page crawls.
  -- List page crawls (agent_id IS NULL) are attributed to agents matching
  -- the city/state in the page path.
  UPDATE professionals p
  SET
    ai_surfaces_monthly_est = round(COALESCE(sub.total_crawls, 0) * scale_factor),
    ai_surfaces_updated_at = now()
  FROM (
    SELECT agent_id, count(*) as total_crawls
    FROM (
      -- Direct profile/artifact crawls (agent_id already resolved)
      SELECT agent_id FROM bot_crawl_logs WHERE agent_id IS NOT NULL
      UNION ALL
      -- List page crawls: attribute to agents in that city/state
      SELECT p2.id as agent_id
      FROM bot_crawl_logs b
      JOIN professionals p2
        ON p2.active = true
        AND b.agent_id IS NULL
        AND b.page_path LIKE '%/top10realestateagents'
        AND LOWER(p2.business_city) = LOWER(replace(split_part(b.page_path, '/', 3), '-', ' '))
        AND p2.state_slug = split_part(b.page_path, '/', 2)
    ) combined
    GROUP BY agent_id
  ) sub
  WHERE p.id = sub.agent_id
    AND p.active = true;

  UPDATE professionals
  SET ai_surfaces_monthly_est = 0, ai_surfaces_updated_at = now()
  WHERE active = true
    AND ai_surfaces_updated_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rollup_ai_surfaces_monthly IS
  'Extrapolates all bot crawl data to 30-day monthly estimate per agent. Every bot crawl surfaces the agent in an index consumed by AI. Runs daily 5am UTC.';

-- Cron: run daily at 5am UTC
SELECT cron.schedule('rollup-ai-surfaces-daily', '0 5 * * *', 'SELECT rollup_ai_surfaces_monthly()');
