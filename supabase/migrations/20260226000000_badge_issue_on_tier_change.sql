-- Badge issuance on tier change: track last tier we notified so we only email when tier actually changes.
-- Hourly cron calls badge-issue edge function; it finds professionals where current_tier != last_tier_badge_notified,
-- sends Web of Truth email with link to badge instructions, then sets last_tier_badge_notified = current_tier and badge_tier = current_tier.

ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS last_tier_badge_notified TEXT;

COMMENT ON COLUMN professionals.last_tier_badge_notified IS 'Last tier we sent badge/tier-change email for. When current_tier != this, badge-issue sends email and updates this. Ensures one email per tier change.';
