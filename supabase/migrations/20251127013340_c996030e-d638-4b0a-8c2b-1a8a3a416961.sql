-- Create Arizona licenses table for fast license lookups
CREATE TABLE IF NOT EXISTS public.arizona_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_number text NOT NULL UNIQUE,
  last_name text,
  first_name text,
  middle_name text,
  original_date date,
  license_type text,
  employer_legal_name text,
  employer_phone text,
  mailing_address1 text,
  mailing_address2 text,
  mailing_city text,
  mailing_state text,
  mailing_zip text,
  mailing_county text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create index for fast license number lookups
CREATE INDEX IF NOT EXISTS idx_arizona_licenses_license_number ON public.arizona_licenses(license_number);

-- Create index for name searches
CREATE INDEX IF NOT EXISTS idx_arizona_licenses_names ON public.arizona_licenses(last_name, first_name);

-- Enable RLS
ALTER TABLE public.arizona_licenses ENABLE ROW LEVEL SECURITY;

-- Allow public read access (license verification is public data)
CREATE POLICY "Anyone can view licenses"
  ON public.arizona_licenses
  FOR SELECT
  USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage licenses"
  ON public.arizona_licenses
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));