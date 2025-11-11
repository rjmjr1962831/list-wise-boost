-- Create specialties/tags table for centralized management
CREATE TABLE IF NOT EXISTS public.specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;

-- Anyone can view active specialties
CREATE POLICY "Anyone can view active specialties"
ON public.specialties
FOR SELECT
USING (active = true);

-- Authenticated users can add new specialties
CREATE POLICY "Authenticated users can add specialties"
ON public.specialties
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Admins can manage all specialties
CREATE POLICY "Admins can manage specialties"
ON public.specialties
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_specialties_category ON public.specialties(category_id);
CREATE INDEX idx_specialties_name ON public.specialties(name);

-- Add verification_token to professionals table for secure verification links
ALTER TABLE public.professionals
ADD COLUMN IF NOT EXISTS verification_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_started_at TIMESTAMP WITH TIME ZONE;

-- Create index on verification_token
CREATE INDEX idx_professionals_verification_token ON public.professionals(verification_token) WHERE verification_token IS NOT NULL;