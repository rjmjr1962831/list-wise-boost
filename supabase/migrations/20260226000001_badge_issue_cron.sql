-- Badge issue on tier change: run hourly. Finds professionals where current_tier != last_tier_badge_notified,
-- sends Web of Truth email with link to badge instructions, updates last_tier_badge_notified and badge_tier.

SELECT cron.unschedule('badge-issue-on-tier-change');

SELECT cron.schedule(
  'badge-issue-on-tier-change',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/badge-issue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Enrichment-Key', 't10l_enrich_0448c4870d72ed90fd43171123fd0e44558f019a2b5807d1b297604dad6b235a'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Runs at minute 0 of every hour (00:00, 01:00, ... UTC). Up to 100 tier changes per run; each gets one email.
