-- Create table for protocol service inquiries
CREATE TABLE public.protocol_service_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  service_tier TEXT NOT NULL,
  industry TEXT NOT NULL,
  project_description TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.protocol_service_inquiries ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public form)
CREATE POLICY "Anyone can submit service inquiries"
ON public.protocol_service_inquiries
FOR INSERT
WITH CHECK (true);

-- Only authenticated admins can view (for now, restrict all reads via RLS)
CREATE POLICY "Admins can view service inquiries"
ON public.protocol_service_inquiries
FOR SELECT
USING (false);

-- Create trigger for updated_at
CREATE TRIGGER update_protocol_service_inquiries_updated_at
BEFORE UPDATE ON public.protocol_service_inquiries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();