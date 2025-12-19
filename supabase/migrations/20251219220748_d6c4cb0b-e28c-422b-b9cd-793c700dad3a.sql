-- Remove duplicate New Mexico cities with abbreviation state_slug
-- Verified: No professionals linked to these records
DELETE FROM cities WHERE state_slug = 'nm';

-- Standardize any remaining abbreviation state_slugs to full names for future consistency
-- This ensures all active cities use the canonical full state name format