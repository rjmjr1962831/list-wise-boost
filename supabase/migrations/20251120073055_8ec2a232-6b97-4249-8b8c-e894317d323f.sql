-- Add email_verified_at column to professionals table for tracking email verification status
ALTER TABLE public.professionals 
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE NULL;