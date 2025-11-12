-- Update the type field constraint to allow 'individual' and 'team' values
ALTER TABLE professionals DROP CONSTRAINT IF EXISTS professionals_type_check;
ALTER TABLE professionals ADD CONSTRAINT professionals_type_check CHECK (type IN ('established', 'emerging', 'individual', 'team'));