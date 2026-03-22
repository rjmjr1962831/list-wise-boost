-- Migration: Add served_neighborhoods to professionals
-- The column stores an array of neighborhood slugs (e.g., ["hollywood", "silver-lake"])
-- matching neighborhood_catalog.neighborhood_slug values.
-- Used to attribute neighborhood-page bot crawls to the correct agents.

ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS served_neighborhoods JSONB DEFAULT '[]'::jsonb;

-- GIN index for containment queries like:
--   WHERE served_neighborhoods @> '"hollywood"'::jsonb
COMMENT ON COLUMN professionals.served_neighborhoods
  IS 'Array of neighborhood slugs from neighborhood_catalog.neighborhood_slug that this agent serves';

CREATE INDEX IF NOT EXISTS idx_professionals_served_neighborhoods
  ON professionals USING GIN (served_neighborhoods);
