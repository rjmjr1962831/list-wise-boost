-- Create agent_applications table for onboarding submissions
CREATE TABLE public.agent_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  brokerage_name TEXT NOT NULL,
  is_team_member BOOLEAN NOT NULL DEFAULT false,
  team_name TEXT,
  bio TEXT NOT NULL,
  license_number TEXT NOT NULL,
  license_verified BOOLEAN NOT NULL DEFAULT false,
  website TEXT NOT NULL,
  email TEXT NOT NULL,
  publish_email BOOLEAN NOT NULL DEFAULT false,
  phone TEXT NOT NULL,
  zillow_url TEXT,
  home_url TEXT,
  specialties TEXT[] NOT NULL DEFAULT '{}',
  state TEXT NOT NULL,
  cities TEXT[] NOT NULL DEFAULT '{}',
  zip_codes JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_applications ENABLE ROW LEVEL SECURITY;

-- Anyone can submit applications
CREATE POLICY "Anyone can submit applications"
  ON public.agent_applications
  FOR INSERT
  WITH CHECK (true);

-- Admins can view and manage applications
CREATE POLICY "Admins can manage applications"
  ON public.agent_applications
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create index for status queries
CREATE INDEX idx_agent_applications_status ON public.agent_applications(status);

-- Add trigger for updated_at
CREATE TRIGGER update_agent_applications_updated_at
  BEFORE UPDATE ON public.agent_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();