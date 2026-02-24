-- Run in Supabase Dashboard → SQL Editor (one-time) to add column for badge-issue-on-tier-change.
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS last_tier_badge_notified TEXT;

COMMENT ON COLUMN professionals.last_tier_badge_notified IS 'Last tier we sent badge/tier-change email for. When current_tier != this, badge-issue sends email and updates this.';
