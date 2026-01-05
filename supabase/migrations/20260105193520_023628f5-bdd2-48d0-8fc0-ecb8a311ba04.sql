-- Create protocol_adopters table for AI Citation Protocol registrations
CREATE TABLE public.protocol_adopters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  llms_txt_url TEXT,
  industry TEXT NOT NULL,
  implementation_status TEXT NOT NULL CHECK (implementation_status IN ('live', 'in_progress', 'planned')),
  notes TEXT,
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for displaying approved adopters
CREATE INDEX idx_protocol_adopters_approved ON public.protocol_adopters(approved, created_at DESC);

-- Enable RLS
ALTER TABLE public.protocol_adopters ENABLE ROW LEVEL SECURITY;

-- Public can view approved adopters
CREATE POLICY "Anyone can view approved adopters" 
ON public.protocol_adopters 
FOR SELECT 
USING (approved = true);

-- Anyone can insert (submit registration)
CREATE POLICY "Anyone can register as adopter" 
ON public.protocol_adopters 
FOR INSERT 
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_protocol_adopters_updated_at
BEFORE UPDATE ON public.protocol_adopters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();