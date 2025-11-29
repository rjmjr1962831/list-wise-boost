-- Add Zillow-specific columns to prospects table
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS zillow_profile_id TEXT UNIQUE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS zillow_scraped_at TIMESTAMPTZ;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS zillow_sales_count INTEGER;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS zillow_sales_volume TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS zillow_photo_url TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_prospects_zillow_profile_id ON prospects(zillow_profile_id);

-- Create scrape_jobs table for tracking scrape history
CREATE TABLE IF NOT EXISTS scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  apify_run_id TEXT,
  agents_found INTEGER DEFAULT 0,
  agents_saved INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on scrape_jobs
ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage scrape jobs
CREATE POLICY "Admins can manage scrape jobs"
ON scrape_jobs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));