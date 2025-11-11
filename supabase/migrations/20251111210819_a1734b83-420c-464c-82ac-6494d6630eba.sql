-- Add zuid column to professionals table to store Zillow unique agent ID
ALTER TABLE public.professionals
ADD COLUMN zuid text;

-- Add index for faster lookups
CREATE INDEX idx_professionals_zuid ON public.professionals(zuid);