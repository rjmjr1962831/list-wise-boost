-- Create zillow_search_results table for crawler data
CREATE TABLE public.zillow_search_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  zillow_url text,
  zillow_rating numeric,
  zillow_reviews integer,
  status text NOT NULL DEFAULT 'found',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_zillow_search_results_agent_city ON public.zillow_search_results (agent_name, city, state);
CREATE INDEX idx_zillow_search_results_status ON public.zillow_search_results (status);

-- Enable RLS
ALTER TABLE public.zillow_search_results ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for edge function)
CREATE POLICY "Service role can manage zillow results"
ON public.zillow_search_results
FOR ALL
USING (true);

-- Admins can view
CREATE POLICY "Admins can view zillow results"
ON public.zillow_search_results
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_zillow_search_results_updated_at
  BEFORE UPDATE ON public.zillow_search_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();