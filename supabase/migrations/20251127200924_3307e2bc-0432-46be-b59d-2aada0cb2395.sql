-- Add index on license_number for fast lookups
CREATE INDEX IF NOT EXISTS idx_arizona_licenses_license_number ON arizona_licenses(license_number);

-- Add comment explaining the index
COMMENT ON INDEX idx_arizona_licenses_license_number IS 'Optimizes license number lookups during verification';