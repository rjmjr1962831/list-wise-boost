-- Add columns for website crawl results and enhanced gap tracking
ALTER TABLE geo_audit_results
  ADD COLUMN IF NOT EXISTS has_schema_markup boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_google_business boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_homes_com boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS schema_types_found text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS website_crawled text,
  ADD COLUMN IF NOT EXISTS website_crawlable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS gap_no_google_business boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS gap_no_homes_com boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_body text,
  ADD COLUMN IF NOT EXISTS gaps_found jsonb DEFAULT '[]'::jsonb;
