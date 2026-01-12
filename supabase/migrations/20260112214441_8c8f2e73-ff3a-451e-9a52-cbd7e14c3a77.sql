-- Create cron state table to track the background job
CREATE TABLE IF NOT EXISTS public.cron_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name TEXT NOT NULL UNIQUE,
  is_running BOOLEAN NOT NULL DEFAULT false,
  status TEXT DEFAULT 'idle',
  message TEXT,
  consecutive_errors INTEGER DEFAULT 0,
  total_processed INTEGER DEFAULT 0,
  total_found INTEGER DEFAULT 0,
  total_not_found INTEGER DEFAULT 0,
  total_errors INTEGER DEFAULT 0,
  remaining_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert the initial state for our CA zillow job
INSERT INTO public.cron_state (job_name, is_running, status, started_at, remaining_count)
VALUES ('exa-ca-zillow', true, 'running', now(), 281557)
ON CONFLICT (job_name) DO UPDATE SET
  is_running = true,
  status = 'running',
  started_at = now(),
  consecutive_errors = 0;

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net;