-- Bot crawls per agent per time period
-- Run in Supabase SQL Editor. We have two sources:

-- 1) agent_bot_visit_summary = pre-aggregated per (agent_id, date)
--    Use for: daily counts, fast queries over recent days.
--    Retention: only last 90 days kept (see purge_agent_bot_visit_summary_retention).

-- 2) cloudflare_request_logs = raw rows with agent_id, timestamp, is_bot
--    Use for: custom periods (e.g. last 7 days, last 24h), hourly, or when you need raw detail.

-- =============================================================================
-- 0) Quick check: is there any data in cloudflare_request_logs?
-- =============================================================================
SELECT
  (SELECT COUNT(*) FROM public.cloudflare_request_logs) AS total_rows,
  (SELECT COUNT(*) FROM public.cloudflare_request_logs WHERE is_bot = true) AS bot_rows,
  (SELECT COUNT(*) FROM public.cloudflare_request_logs WHERE is_bot = true AND agent_id IS NOT NULL) AS bot_rows_with_agent_id;

-- Sample of latest 3 rows (optional — run separately if you want to see rows):
-- SELECT id, timestamp, path, is_bot, bot_type, agent_id
-- FROM public.cloudflare_request_logs
-- ORDER BY timestamp DESC
-- LIMIT 3;

-- =============================================================================
-- A) Daily bot crawls per agent (from summary table) — last 30 days
-- =============================================================================
SELECT
  s.agent_id,
  p.name AS agent_name,
  s.date,
  s.total_bot_visits,
  s.profile_visits,
  s.artifact_visits,
  s.cache_hits,
  s.cache_misses,
  s.visits_by_bot_type
FROM public.agent_bot_visit_summary s
JOIN public.professionals p ON p.id = s.agent_id
WHERE s.date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY s.date DESC, s.total_bot_visits DESC;

-- =============================================================================
-- B) Total bot crawls per agent over a time window (e.g. last 7 days) — from summary
-- =============================================================================
SELECT
  s.agent_id,
  p.name AS agent_name,
  COUNT(*) AS days_with_data,
  SUM(s.total_bot_visits) AS total_bot_crawls,
  SUM(s.profile_visits) AS total_profile_visits,
  SUM(s.artifact_visits) AS total_artifact_visits
FROM public.agent_bot_visit_summary s
JOIN public.professionals p ON p.id = s.agent_id
WHERE s.date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY s.agent_id, p.name
ORDER BY total_bot_crawls DESC;

-- =============================================================================
-- C) Bot crawls per agent for a custom time period — from raw logs
--    (Use when you need last 24h, or a specific hour, or exact timestamps.)
-- =============================================================================
SELECT
  crl.agent_id,
  p.name AS agent_name,
  COUNT(*) AS bot_crawls,
  MIN(crl.timestamp) AS first_crawl,
  MAX(crl.timestamp) AS last_crawl
FROM public.cloudflare_request_logs crl
LEFT JOIN public.professionals p ON p.id = crl.agent_id
WHERE crl.is_bot = true
  AND crl.agent_id IS NOT NULL
  AND crl.timestamp >= NOW() - INTERVAL '7 days'
GROUP BY crl.agent_id, p.name
ORDER BY bot_crawls DESC;

-- =============================================================================
-- D) Bot crawls per agent per day (from raw logs) — if you want to bucket by day yourself
-- =============================================================================
SELECT
  crl.agent_id,
  p.name AS agent_name,
  DATE(crl.timestamp) AS day,
  COUNT(*) AS bot_crawls
FROM public.cloudflare_request_logs crl
LEFT JOIN public.professionals p ON p.id = crl.agent_id
WHERE crl.is_bot = true
  AND crl.agent_id IS NOT NULL
  AND crl.timestamp >= NOW() - INTERVAL '30 days'
GROUP BY crl.agent_id, p.name, DATE(crl.timestamp)
ORDER BY day DESC, bot_crawls DESC;
