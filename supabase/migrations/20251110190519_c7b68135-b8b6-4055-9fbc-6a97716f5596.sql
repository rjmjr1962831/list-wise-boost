-- Add display_order column to appointment_types
ALTER TABLE appointment_types ADD COLUMN display_order INTEGER DEFAULT 0;

-- Update existing appointment types with display order
UPDATE appointment_types SET display_order = 1 WHERE name = 'What We Can Do for You';
UPDATE appointment_types SET display_order = 2 WHERE name = 'Onboarding';
UPDATE appointment_types SET display_order = 3 WHERE name = 'Something Else';