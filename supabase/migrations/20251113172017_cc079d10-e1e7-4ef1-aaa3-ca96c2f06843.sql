-- Add Zillow profile caching columns to professionals table
ALTER TABLE public.professionals
ADD COLUMN IF NOT EXISTS zillow_profile_url TEXT,
ADD COLUMN IF NOT EXISTS zillow_data_fetched_at TIMESTAMP WITH TIME ZONE;