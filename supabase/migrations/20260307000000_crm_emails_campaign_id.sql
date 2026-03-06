-- Add campaign_id to crm_emails for LifeLock-style outbound campaigns (once per professional).
ALTER TABLE crm_emails ADD COLUMN IF NOT EXISTS campaign_id text;
CREATE INDEX IF NOT EXISTS crm_emails_campaign_professional_idx ON crm_emails(campaign_id, professional_id) WHERE campaign_id IS NOT NULL;
