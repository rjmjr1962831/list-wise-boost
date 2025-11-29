-- Create enum for prospect status
CREATE TYPE prospect_status AS ENUM ('new', 'contacted', 'interested', 'customer', 'declined');

-- Create prospects table
CREATE TABLE public.prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core fields
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  city TEXT,
  state TEXT,
  
  -- Zillow fields
  zillow_position INTEGER,
  zillow_page INTEGER,
  agents_ahead INTEGER,
  zillow_total_agents INTEGER,
  zillow_rating NUMERIC(3,2),
  zillow_reviews INTEGER,
  zillow_profile_url TEXT,
  
  -- CRM fields
  status prospect_status DEFAULT 'new',
  email_snippet TEXT,
  
  -- HubSpot sync tracking
  hubspot_contact_id TEXT,
  hubspot_synced BOOLEAN DEFAULT false,
  hubspot_synced_at TIMESTAMPTZ,
  hubspot_last_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_prospects_email ON public.prospects(email);
CREATE INDEX idx_prospects_hubspot_contact_id ON public.prospects(hubspot_contact_id);
CREATE INDEX idx_prospects_hubspot_synced ON public.prospects(hubspot_synced);
CREATE INDEX idx_prospects_status ON public.prospects(status);
CREATE INDEX idx_prospects_created_at ON public.prospects(created_at DESC);

-- Enable RLS
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin access
CREATE POLICY "Admins can manage prospects"
  ON public.prospects
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Trigger to update updated_at
CREATE TRIGGER update_prospects_updated_at
  BEFORE UPDATE ON public.prospects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();