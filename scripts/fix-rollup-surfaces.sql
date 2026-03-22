-- fix-rollup-surfaces.sql
-- Corrected rollup cron: neighborhood crawls now join on served_neighborhoods
-- instead of served_cities. City crawls and profile crawls unchanged.
--
-- Path patterns:
--   City page:         /{state}/{city}/top10realestateagents
--   Neighborhood page: /{state}/{city}/{neighborhood}/top10realestateagents
--   Agent profile:     /{state}/agents/{canonical_slug}
--
-- Differentiation: split_part(page_path, '/', 4) starting with 'top10' = city page;
-- otherwise it's a neighborhood slug.

-- ============================================================
-- 1. Drop the old cron job
-- ============================================================
SELECT cron.unschedule('rollup-agent-ai-surfaces');

-- ============================================================
-- 2. Replace the rollup function
-- ============================================================
CREATE OR REPLACE FUNCTION rollup_ai_surfaces_monthly()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- --------------------------------------------------------
  -- Stage 1: TRUNCATE + INSERT into agent_ai_surfaces_by_bot
  -- --------------------------------------------------------
  TRUNCATE agent_ai_surfaces_by_bot;

  INSERT INTO agent_ai_surfaces_by_bot (agent_id, bot_name, crawls, computed_at)
  SELECT agent_id, bot_name, SUM(crawls)::int AS crawls, now() AS computed_at
  FROM (
    -- A) City page crawls
    SELECT p.id AS agent_id, bcl.bot_name, COUNT(*) AS crawls
    FROM bot_crawl_logs bcl
    JOIN professionals p
      ON p.active = true
     AND p.served_cities @> to_jsonb(split_part(bcl.page_path, '/', 3))
    WHERE bcl.crawled_at > now() - interval '7 days'
      AND bcl.page_path ~ '^/[a-z-]+/[a-z0-9-]+/top10realestateagents'
      AND split_part(bcl.page_path, '/', 4) LIKE 'top10%'
    GROUP BY p.id, bcl.bot_name

    UNION ALL

    -- B) Neighborhood page crawls
    SELECT p.id AS agent_id, bcl.bot_name, COUNT(*) AS crawls
    FROM bot_crawl_logs bcl
    JOIN professionals p
      ON p.active = true
     AND p.served_neighborhoods @> to_jsonb(split_part(bcl.page_path, '/', 4))
    WHERE bcl.crawled_at > now() - interval '7 days'
      AND bcl.page_path ~ '^/[a-z-]+/[a-z0-9-]+/[a-z0-9-]+/top10realestateagents'
      AND split_part(bcl.page_path, '/', 4) NOT LIKE 'top10%'
    GROUP BY p.id, bcl.bot_name

    UNION ALL

    -- C) Agent profile page crawls
    SELECT p.id AS agent_id, bcl.bot_name, COUNT(*) AS crawls
    FROM bot_crawl_logs bcl
    JOIN professionals p
      ON p.active = true
     AND p.canonical_slug = split_part(bcl.page_path, '/', 4)
    WHERE bcl.crawled_at > now() - interval '7 days'
      AND bcl.page_path ~ '^/[a-z-]+/agents/[a-z0-9-]+'
    GROUP BY p.id, bcl.bot_name
  ) combined
  GROUP BY agent_id, bot_name;

  -- --------------------------------------------------------
  -- Stage 2: TRUNCATE + INSERT into agent_ai_surfaces
  --          (aggregate totals from by_bot table)
  -- --------------------------------------------------------
  TRUNCATE agent_ai_surfaces;

  INSERT INTO agent_ai_surfaces (agent_id, period, total_surfaces, computed_at)
  SELECT
    agent_id,
    '7d'                     AS period,
    SUM(crawls)::int         AS total_surfaces,
    now()                    AS computed_at
  FROM agent_ai_surfaces_by_bot
  GROUP BY agent_id
  ON CONFLICT (agent_id, period) DO UPDATE
    SET total_surfaces = EXCLUDED.total_surfaces,
        computed_at    = EXCLUDED.computed_at;

  -- --------------------------------------------------------
  -- Stage 3: Update professionals.ai_surfaces_monthly_est
  -- --------------------------------------------------------
  UPDATE professionals p
  SET
    ai_surfaces_monthly_est = ROUND(s.total_surfaces * (30.0 / 7)),
    ai_surfaces_updated_at  = now()
  FROM agent_ai_surfaces s
  WHERE s.agent_id = p.id;

END;
$$;

-- ============================================================
-- 3. Schedule the new cron job (daily at 04:00 UTC)
-- ============================================================
SELECT cron.schedule(
  'rollup-ai-surfaces',
  '0 4 * * *',
  'SELECT rollup_ai_surfaces_monthly()'
);
