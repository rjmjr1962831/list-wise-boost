-- Create email verification queue table
CREATE TABLE IF NOT EXISTS public.email_verification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  priority INTEGER DEFAULT 0,
  verification_result JSONB,
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  delay_seconds INTEGER DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(professional_id)
);

-- Create index for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_email_verification_queue_status_priority 
  ON public.email_verification_queue(status, priority DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_email_verification_queue_professional 
  ON public.email_verification_queue(professional_id);

-- Enable RLS
ALTER TABLE public.email_verification_queue ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can view all queue items"
  ON public.email_verification_queue
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert queue items"
  ON public.email_verification_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update queue items"
  ON public.email_verification_queue
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete queue items"
  ON public.email_verification_queue
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_verification_queue;