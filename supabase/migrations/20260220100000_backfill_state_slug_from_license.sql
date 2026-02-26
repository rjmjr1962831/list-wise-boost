-- Backfill state_slug from license_number where state_slug is null.
-- Rules (by license prefix/format):
--   Arizona:  SA = salesperson/agent, BR = broker (Arizona ADRE)
--   California: 8-digit numeric only (no letter prefix; DRE uses e.g. 01976742, 02065919)
-- Other states: not inferred by this migration.

UPDATE professionals
SET state_slug = 'arizona'
WHERE state_slug IS NULL
  AND license_number IS NOT NULL
  AND TRIM(license_number) <> ''
  AND UPPER(LEFT(TRIM(license_number), 2)) IN ('SA', 'BR');

UPDATE professionals
SET state_slug = 'california'
WHERE state_slug IS NULL
  AND license_number IS NOT NULL
  AND TRIM(license_number) <> ''
  AND TRIM(license_number) ~ '^[0-9]{6,10}$';
