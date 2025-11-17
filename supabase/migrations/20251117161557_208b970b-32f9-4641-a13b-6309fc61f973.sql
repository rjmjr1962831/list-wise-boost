-- Add address column to professionals table for storing office/mailing address
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS address TEXT;