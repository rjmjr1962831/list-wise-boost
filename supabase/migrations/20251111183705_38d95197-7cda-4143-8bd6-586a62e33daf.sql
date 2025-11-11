-- Add company field to professionals table
ALTER TABLE public.professionals
ADD COLUMN IF NOT EXISTS company TEXT;