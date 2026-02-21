-- Run in Supabase SQL Editor before first run of google_maps_enrichment.py
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS google_business_name TEXT,
  ADD COLUMN IF NOT EXISTS google_address TEXT,
  ADD COLUMN IF NOT EXISTS google_rating NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS google_review_count INTEGER,
  ADD COLUMN IF NOT EXISTS google_maps_url TEXT,
  ADD COLUMN IF NOT EXISTS google_phone TEXT,
  ADD COLUMN IF NOT EXISTS google_enriched_at TIMESTAMPTZ;
