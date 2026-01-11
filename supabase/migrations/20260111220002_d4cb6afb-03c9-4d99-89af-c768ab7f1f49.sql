-- Add columns to store generated writeups
ALTER TABLE neighborhood_catalog 
ADD COLUMN IF NOT EXISTS writeup_html TEXT,
ADD COLUMN IF NOT EXISTS writeup_research TEXT,
ADD COLUMN IF NOT EXISTS writeup_generated_at TIMESTAMPTZ;