-- Report: Inactive agents and basic pre-qualification data (license, state, star level).
-- Every inactive agent should have license_number, state_slug, and basic pre-qualification data (review_stars_rating).
-- Run in Supabase SQL Editor.
--
-- State-from-license rules (for backfill):
--   Arizona:  SA = salesperson/agent, BR = broker (ADRE).
--   California: 8-digit numeric only (no letter prefix; DRE e.g. 01976742, 02065919).

-- 1) Summary: inactive counts and how many are missing license / state / rating
SELECT
  COUNT(*) AS inactive_total,
  COUNT(*) FILTER (WHERE license_number IS NULL OR TRIM(license_number) = '') AS missing_license,
  COUNT(*) FILTER (WHERE state_slug IS NULL OR TRIM(state_slug) = '') AS missing_state,
  COUNT(*) FILTER (WHERE review_stars_rating IS NULL) AS missing_rating,
  COUNT(*) FILTER (
    WHERE (license_number IS NULL OR TRIM(license_number) = '')
       OR (state_slug IS NULL OR TRIM(state_slug) = '')
       OR review_stars_rating IS NULL
  ) AS missing_any_basic
FROM professionals
WHERE active = false;

-- 2) List inactive agents with basic info (license, state, rating) and missing-data flags
SELECT
  p.id,
  p.name,
  p.state_slug AS state,
  p.license_number AS license,
  p.review_stars_rating AS rating,
  p.num_total_reviews AS reviews,
  CASE WHEN p.license_number IS NULL OR TRIM(p.license_number) = '' THEN 'missing' ELSE 'ok' END AS license_ok,
  CASE WHEN p.state_slug IS NULL OR TRIM(p.state_slug) = '' THEN 'missing' ELSE 'ok' END AS state_ok,
  CASE WHEN p.review_stars_rating IS NULL THEN 'missing' ELSE 'ok' END AS rating_ok,
  p.updated_at
FROM professionals p
WHERE p.active = false
ORDER BY
  (CASE WHEN p.license_number IS NULL OR TRIM(p.license_number) = '' THEN 0 ELSE 1 END),
  (CASE WHEN p.state_slug IS NULL OR TRIM(p.state_slug) = '' THEN 0 ELSE 1 END),
  (CASE WHEN p.review_stars_rating IS NULL THEN 0 ELSE 1 END),
  p.name;

-- 3) Inactive agents missing license and/or state (for backfill priority)
SELECT
  p.id,
  p.name,
  p.email,
  p.city_id,
  c.name AS city_name,
  c.state_slug AS city_state_slug,
  p.state_slug AS prof_state_slug,
  p.license_number,
  p.review_stars_rating,
  p.num_total_reviews
FROM professionals p
LEFT JOIN cities c ON c.id = p.city_id
WHERE p.active = false
  AND (
    (p.license_number IS NULL OR TRIM(p.license_number) = '')
    OR (p.state_slug IS NULL OR TRIM(p.state_slug) = '')
  )
ORDER BY p.name;
