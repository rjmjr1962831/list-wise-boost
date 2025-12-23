-- Create table to track pipeline state
CREATE TABLE public.pipeline_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_name TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL,
  state_abbr TEXT NOT NULL,
  current_index INTEGER NOT NULL DEFAULT 0,
  batch_size INTEGER NOT NULL DEFAULT 50,
  concurrency INTEGER NOT NULL DEFAULT 5,
  is_running BOOLEAN NOT NULL DEFAULT false,
  is_paused BOOLEAN NOT NULL DEFAULT false,
  total_processed INTEGER NOT NULL DEFAULT 0,
  total_qualified INTEGER NOT NULL DEFAULT 0,
  total_not_qualified INTEGER NOT NULL DEFAULT 0,
  total_duplicates INTEGER NOT NULL DEFAULT 0,
  total_no_results INTEGER NOT NULL DEFAULT 0,
  total_errors INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipeline_state ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage pipeline state
CREATE POLICY "Admins can manage pipeline state" 
ON public.pipeline_state 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role has full access to pipeline state"
ON public.pipeline_state
FOR ALL
USING (auth.role() = 'service_role');

-- Create trigger for updated_at
CREATE TRIGGER update_pipeline_state_updated_at
BEFORE UPDATE ON public.pipeline_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();