-- Add website field to contacts table
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS website text;