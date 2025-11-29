-- Add Pipedrive sync columns to prospects table
ALTER TABLE prospects 
ADD COLUMN IF NOT EXISTS pipedrive_person_id BIGINT,
ADD COLUMN IF NOT EXISTS pipedrive_synced BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pipedrive_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pipedrive_last_error TEXT;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_prospects_pipedrive_person_id 
ON prospects(pipedrive_person_id);

CREATE INDEX IF NOT EXISTS idx_prospects_pipedrive_synced 
ON prospects(pipedrive_synced);

-- Create Pipedrive field mapping table
CREATE TABLE IF NOT EXISTS pipedrive_field_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name TEXT UNIQUE NOT NULL,
  pipedrive_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for pipedrive_field_mapping
ALTER TABLE pipedrive_field_mapping ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to manage field mappings
CREATE POLICY "Admins can manage pipedrive field mappings"
ON pipedrive_field_mapping
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert placeholder field mappings (to be updated in admin UI)
INSERT INTO pipedrive_field_mapping (field_name, pipedrive_key) VALUES
  ('supabase_id', 'REPLACE_WITH_YOUR_KEY'),
  ('zillow_position', 'REPLACE_WITH_YOUR_KEY'),
  ('zillow_page', 'REPLACE_WITH_YOUR_KEY'),
  ('agents_ahead', 'REPLACE_WITH_YOUR_KEY'),
  ('zillow_total_agents', 'REPLACE_WITH_YOUR_KEY'),
  ('zillow_rating', 'REPLACE_WITH_YOUR_KEY'),
  ('zillow_reviews', 'REPLACE_WITH_YOUR_KEY'),
  ('zillow_profile_url', 'REPLACE_WITH_YOUR_KEY'),
  ('prospect_status', 'REPLACE_WITH_YOUR_KEY')
ON CONFLICT (field_name) DO NOTHING;