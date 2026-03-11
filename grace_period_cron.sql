-- Grace Period Cleanup Cron Job
-- Runs daily at midnight UTC to downgrade agents whose grace period has expired

SELECT cron.schedule(
  'cleanup-expired-grace-periods',
  '0 0 * * *',  -- Every 24 hours at midnight UTC
  $$
  UPDATE professionals
  SET badge_tier = 'listed',
      badge_status = 'lapsed',
      subscription_status = 'past_due'
  WHERE badge_status = 'grace_period'
    AND grace_period_ends_at < NOW();
  $$
);

-- To check cron job status:
-- SELECT * FROM cron.job WHERE jobname = 'cleanup-expired-grace-periods';

-- To manually run the cleanup (for testing):
-- UPDATE professionals
-- SET badge_tier = 'listed',
--     badge_status = 'lapsed',
--     subscription_status = 'past_due'
-- WHERE badge_status = 'grace_period'
--   AND grace_period_ends_at < NOW();
