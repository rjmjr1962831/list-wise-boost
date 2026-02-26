-- Run after 20260220100000_backfill_state_slug_from_license.sql to verify backfill.
-- Run in Supabase SQL Editor.
-- (UPDATE always shows "No rows returned" in the UI — that's normal; run these SELECTs to verify.)

-- 1) One-row summary: always returns something
SELECT
  (SELECT COUNT(*) FROM professionals WHERE active = false) AS inactive_total,
  (SELECT COUNT(*) FROM professionals WHERE active = false AND state_slug IS NOT NULL AND TRIM(state_slug) <> '') AS inactive_with_state,
  (SELECT COUNT(*) FROM professionals WHERE active = false AND license_number IS NOT NULL AND TRIM(license_number) <> '' AND (state_slug IS NULL OR TRIM(state_slug) = '')) AS inactive_has_license_but_no_state;

-- 2) Inactive agents: count by state_slug (after backfill)
SELECT
  COALESCE(state_slug, '(null)') AS state_slug,
  COUNT(*) AS count
FROM professionals
WHERE active = false
GROUP BY state_slug
ORDER BY count DESC;

-- 3) Inactive agents that still have license but no state (should be 0 or few)
SELECT COUNT(*) AS inactive_with_license_but_no_state
FROM professionals
WHERE active = false
  AND license_number IS NOT NULL
  AND TRIM(license_number) <> ''
  AND (state_slug IS NULL OR TRIM(state_slug) = '');

-- 4) Sample of inactive with state: arizona or california (license matched backfill rule)
SELECT id, name, license_number, state_slug, active
FROM professionals
WHERE active = false
  AND state_slug IN ('arizona', 'california')
  AND license_number IS NOT NULL
ORDER BY state_slug, name
LIMIT 20;
