-- Fix state_slug for Arizona agents sourced from arizona_licenses
UPDATE professionals 
SET state_slug = 'arizona' 
WHERE state_slug IS NULL 
  AND license_number IN (
    SELECT license_number 
    FROM arizona_licenses
  );

-- Add indexes for search performance
CREATE INDEX IF NOT EXISTS idx_professionals_state_slug ON professionals(state_slug);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_professionals_name_trgm ON professionals USING gin(name gin_trgm_ops);