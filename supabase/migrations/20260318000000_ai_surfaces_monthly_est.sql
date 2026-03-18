-- Add monthly AI surface estimate to professionals
-- An AI 'surface' = any time the agent appeared on a page crawled by an AI bot
-- (list page or profile page). This is 'surfaced to AI', not 'named by AI'.
-- Extrapolated from actual days of bot_crawl_logs data to 30-day estimate.

ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS ai_surfaces_monthly_est integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_surfaces_updated_at timestamptz;

-- Function: extrapolate AI bot crawls to monthly estimate per agent
CREATE OR REPLACE FUNCTION rollup_ai_surfaces_monthly()
RETURNS void AS $$
DECLARE
  days_of_data numeric;
  scale_factor numeric;
BEGIN
  SELECT GREATEST(1, EXTRACT(EPOCH FROM (max(crawled_at) - min(crawled_at))) / 86400.0)
  INTO days_of_data
  FROM bot_crawl_logs;

  scale_factor := 30.0 / days_of_data;

  UPDATE professionals p
  SET
    ai_surfaces_monthly_est = COALESCE(sub.ai_crawls, 0) * scale_factor,
    ai_surfaces_updated_at = now()
  FROM (
    SELECT
      agent_id,
      count(*) as ai_crawls
    FROM bot_crawl_logs
    WHERE bot_name IN (
      'ChatGPT-User', 'GPTBot', 'ClaudeBot', 'Anthropic-AI',
      'PerplexityBot', 'Gemini-AI', 'Meta-ExternalAgent',
      'Applebot', 'OAI-SearchBot'
    )
    AND agent_id IS NOT NULL
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
  'Extrapolates AI bot crawl data to a 30-day monthly estimate per agent. Runs daily via pg_cron at 5am UTC.';

-- Cron: run daily at 5am UTC
SELECT cron.schedule('rollup-ai-surfaces-daily', '0 5 * * *', 'SELECT rollup_ai_surfaces_monthly()');
