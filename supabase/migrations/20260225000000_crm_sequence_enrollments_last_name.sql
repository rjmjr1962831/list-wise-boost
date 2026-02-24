-- Add last_name to enrollments for template {{lastName}}
ALTER TABLE crm_sequence_enrollments
  ADD COLUMN IF NOT EXISTS last_name TEXT;
