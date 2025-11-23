-- Create enrichment queue table for batch state management
CREATE TABLE IF NOT EXISTS public.enrichment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL, -- 'memo23' or 'stats'
  city_id UUID REFERENCES public.cities(id),
  city_name TEXT NOT NULL,
  category_id UUID,
  category_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'paused', 'completed', 'failed'
  total_items INTEGER NOT NULL DEFAULT 0,
  processed_items INTEGER NOT NULL DEFAULT 0,
  successful_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,
  current_index INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  paused_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.enrichment_queue ENABLE ROW LEVEL SECURITY;

-- Admins can manage all queue items
CREATE POLICY "Admins can manage enrichment queue"
ON public.enrichment_queue
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_enrichment_queue_status ON public.enrichment_queue(status);
CREATE INDEX idx_enrichment_queue_job_type ON public.enrichment_queue(job_type);

-- Create trigger for updated_at
CREATE TRIGGER update_enrichment_queue_updated_at
  BEFORE UPDATE ON public.enrichment_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();