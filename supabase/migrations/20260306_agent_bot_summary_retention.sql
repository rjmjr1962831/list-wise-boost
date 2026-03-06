-- Bounded growth for agent_bot_visit_summary: keep only last N days.
-- Without this, one row per (agent_id, date) grows without limit (e.g. 50k agents × 365 = 18M+ rows/year).
-- Notifications and dashboards only need recent data; use cloudflare_request_logs for long-range analytics.

-- Retention window: 90 days. To change, edit the constant in purge_agent_bot_visit_summary_retention().
-- Max rows ≈ (agents with bot traffic in window) × 90.

-- Function for cron: delete summary rows older than retention window
CREATE OR REPLACE FUNCTION public.purge_agent_bot_visit_summary_retention()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  retention_days int := 90;
  deleted int;
BEGIN
  WITH deleted_rows AS (
    DELETE FROM public.agent_bot_visit_summary
    WHERE date < CURRENT_DATE - retention_days
    RETURNING 1
  )
  SELECT count(*)::int INTO deleted FROM deleted_rows;
  RETURN deleted;
END;
$$;

COMMENT ON FUNCTION public.purge_agent_bot_visit_summary_retention() IS
  'Deletes agent_bot_visit_summary rows older than 90 days. Run daily via cron. Edit retention_days in function to change.';

-- One-time: remove existing rows older than retention (no-op if already empty)
SELECT public.purge_agent_bot_visit_summary_retention();

-- Schedule daily purge at 03:00 UTC (away from 09:00 bot-notifications)
DO $$
BEGIN
  PERFORM cron.unschedule('purge-agent-bot-summary-retention');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'purge-agent-bot-summary-retention',
  '0 3 * * *',
  $$SELECT public.purge_agent_bot_visit_summary_retention()$$
);

COMMENT ON TABLE public.agent_bot_visit_summary IS
  'Daily summary of bot visits per agent. Retention: only last N days kept (see purge_agent_bot_visit_summary_retention). Use cloudflare_request_logs for long-range analytics.';
