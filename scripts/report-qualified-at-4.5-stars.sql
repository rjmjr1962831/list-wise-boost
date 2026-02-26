-- How many more agents would be active (qualified) if we lowered the minimum star threshold to 4.5?
-- Current rule: active = (review_stars_rating >= 4.8 AND num_total_reviews >= 20).
-- Run in Supabase SQL Editor.

-- 1) One-row summary
SELECT
  (SELECT COUNT(*) FROM professionals WHERE active = true) AS current_active_4.8_plus,
  (SELECT COUNT(*)
   FROM professionals
   WHERE active = false
     AND review_stars_rating >= 4.5
     AND review_stars_rating < 4.8
     AND num_total_reviews >= 20) AS inactive_but_would_qualify_at_4_5,
  (SELECT COUNT(*) FROM professionals WHERE active = true)
  + (SELECT COUNT(*)
     FROM professionals
     WHERE active = false
       AND review_stars_rating >= 4.5
       AND review_stars_rating < 4.8
       AND num_total_reviews >= 20) AS total_active_if_4_5_min;

-- 2) Same but by state
SELECT
  COALESCE(state_slug, '(null)') AS state_slug,
  COUNT(*) FILTER (WHERE active = true) AS current_active,
  COUNT(*) FILTER (WHERE active = false AND review_stars_rating >= 4.5 AND review_stars_rating < 4.8 AND num_total_reviews >= 20) AS would_qualify_at_4_5,
  COUNT(*) FILTER (WHERE active = true)
    + COUNT(*) FILTER (WHERE active = false AND review_stars_rating >= 4.5 AND review_stars_rating < 4.8 AND num_total_reviews >= 20) AS total_at_4_5
FROM professionals
GROUP BY state_slug
ORDER BY total_at_4_5 DESC;

-- 3) Inactive agents in the 4.5–4.8 band (20+ reviews) – sample
SELECT id, name, state_slug, review_stars_rating, num_total_reviews, active
FROM professionals
WHERE active = false
  AND review_stars_rating >= 4.5
  AND review_stars_rating < 4.8
  AND num_total_reviews >= 20
ORDER BY state_slug, review_stars_rating DESC, num_total_reviews DESC
LIMIT 50;
