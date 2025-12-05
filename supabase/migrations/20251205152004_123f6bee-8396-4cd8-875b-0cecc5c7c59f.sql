-- Create table to track prerender recache progress
CREATE TABLE public.prerender_recache_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'stopped')),
  total_urls INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  current_index INTEGER NOT NULL DEFAULT 0,
  urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prerender_recache_jobs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage jobs
CREATE POLICY "Admins can manage prerender jobs"
ON public.prerender_recache_jobs
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger to update updated_at
CREATE TRIGGER update_prerender_jobs_updated_at
BEFORE UPDATE ON public.prerender_recache_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();