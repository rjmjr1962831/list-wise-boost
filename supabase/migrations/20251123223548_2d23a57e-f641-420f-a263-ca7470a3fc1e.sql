-- Create contact enrichment queue table
CREATE TABLE IF NOT EXISTS public.contact_enrichment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  reason TEXT NOT NULL, -- 'generic_email', 'missing_phone', 'both'
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_status ON public.contact_enrichment_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_professional ON public.contact_enrichment_queue(professional_id);

-- Create trigger to update updated_at
CREATE TRIGGER update_contact_enrichment_queue_updated_at
  BEFORE UPDATE ON public.contact_enrichment_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.contact_enrichment_queue ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view queue
CREATE POLICY "Allow authenticated users to view queue"
  ON public.contact_enrichment_queue
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to queue"
  ON public.contact_enrichment_queue
  FOR ALL
  TO service_role
  USING (true);

-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;