-- Add sequence_id to crm_emails for attribution (used by sequence-processor).
ALTER TABLE crm_emails ADD COLUMN IF NOT EXISTS sequence_id uuid REFERENCES crm_sequences(id);
