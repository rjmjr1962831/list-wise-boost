-- Create neighborhood_aliases table for supporting alternate neighborhood names
CREATE TABLE public.neighborhood_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id UUID NOT NULL REFERENCES public.neighborhood_catalog(id) ON DELETE CASCADE,
  alias_slug TEXT NOT NULL,
  alias_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(alias_slug, neighborhood_id)
);

-- Create indexes for efficient lookups
CREATE INDEX idx_neighborhood_aliases_slug ON public.neighborhood_aliases(alias_slug);
CREATE INDEX idx_neighborhood_aliases_neighborhood ON public.neighborhood_aliases(neighborhood_id);

-- Add RLS policies
ALTER TABLE public.neighborhood_aliases ENABLE ROW LEVEL SECURITY;

-- Allow public read access (needed for routing)
CREATE POLICY "Anyone can view neighborhood aliases"
ON public.neighborhood_aliases
FOR SELECT
USING (true);

-- Only admins can modify aliases
CREATE POLICY "Admins can insert neighborhood aliases"
ON public.neighborhood_aliases
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can update neighborhood aliases"
ON public.neighborhood_aliases
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete neighborhood aliases"
ON public.neighborhood_aliases
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_neighborhood_aliases_updated_at
BEFORE UPDATE ON public.neighborhood_aliases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial alias for Sun City Grand -> The Grand
INSERT INTO public.neighborhood_aliases (neighborhood_id, alias_slug, alias_name)
VALUES (
  'ff874066-64b2-4dde-a5b2-028ccb3f5fc1', -- The Grand in Surprise
  'sun-city-grand',
  'Sun City Grand'
);