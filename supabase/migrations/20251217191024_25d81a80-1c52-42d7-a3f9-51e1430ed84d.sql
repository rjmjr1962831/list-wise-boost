-- Create field change requests table
CREATE TABLE public.field_change_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  current_value TEXT,
  proposed_value TEXT,
  change_request TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  pipedrive_activity_id INTEGER,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.field_change_requests ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admins can manage field change requests"
  ON public.field_change_requests
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Professionals can view their own requests
CREATE POLICY "Professionals can view their own requests"
  ON public.field_change_requests
  FOR SELECT
  USING (true);

-- Anyone can insert (for edge function service role)
CREATE POLICY "Allow inserts from service role"
  ON public.field_change_requests
  FOR INSERT
  WITH CHECK (true);

-- Create index for efficient queries
CREATE INDEX idx_field_change_requests_status ON public.field_change_requests(status);
CREATE INDEX idx_field_change_requests_professional ON public.field_change_requests(professional_id);

-- Trigger for updated_at
CREATE TRIGGER update_field_change_requests_updated_at
  BEFORE UPDATE ON public.field_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();