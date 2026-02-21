-- Backfill signal_score ONLY for agents on the list (active = true). ~3,480 total.
-- "Certified" (65) = hot lead: funnel_status IN ('approved', 'edit_complete'). ~61.
-- Listed (45) = on list but not hot. Unlisted get NULL. Run after 20260217_signal_strength_professionals.sql.

-- 0) Clear signal_score for everyone not on the list
UPDATE professionals
SET signal_score = NULL
WHERE active IS NOT TRUE;

-- 1) Listed (all on list) → 45 baseline
UPDATE professionals
SET signal_score = 45
WHERE active = TRUE;

-- 2) Certified (hot: approved profile) → 65  (~61)
UPDATE professionals
SET signal_score = 65
WHERE active = TRUE
  AND funnel_status IN ('approved', 'edit_complete');

-- 3) Accredited → 80
UPDATE professionals
SET signal_score = 80
WHERE active = TRUE AND current_tier = 'accredited';

-- 4) Underwritten → 98
UPDATE professionals
SET signal_score = 98
WHERE active = TRUE AND current_tier = 'underwritten';
