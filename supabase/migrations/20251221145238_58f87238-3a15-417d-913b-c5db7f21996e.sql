-- Create a generic state licenses table for multi-state license verification
CREATE TABLE public.state_licenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state TEXT NOT NULL,
  license_number TEXT NOT NULL,
  name TEXT NOT NULL,
  city TEXT,
  license_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create unique constraint on state + license_number combination
CREATE UNIQUE INDEX idx_state_licenses_unique ON public.state_licenses(state, license_number);

-- Create indexes for common queries
CREATE INDEX idx_state_licenses_state ON public.state_licenses(state);
CREATE INDEX idx_state_licenses_name ON public.state_licenses(name);
CREATE INDEX idx_state_licenses_city ON public.state_licenses(city);

-- Enable RLS
ALTER TABLE public.state_licenses ENABLE ROW LEVEL SECURITY;

-- Allow public read access for license verification
CREATE POLICY "Anyone can view state licenses"
ON public.state_licenses
FOR SELECT
USING (true);

-- Allow admins full access
CREATE POLICY "Admins can manage state licenses"
ON public.state_licenses
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));