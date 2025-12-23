-- Add unique constraint on license_number + state for upsert support
ALTER TABLE state_licenses ADD CONSTRAINT state_licenses_license_number_state_key UNIQUE (license_number, state);