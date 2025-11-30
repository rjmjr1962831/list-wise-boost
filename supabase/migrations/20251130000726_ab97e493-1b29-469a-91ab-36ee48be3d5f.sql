-- Create table for tracking bulk capture progress
CREATE TABLE IF NOT EXISTS public.bulk_capture_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'running', -- running, completed, failed
  current_city TEXT,
  current_index INTEGER DEFAULT 0,
  total_cities INTEGER NOT NULL,
  results JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bulk_capture_session ON public.bulk_capture_progress(session_id);
CREATE INDEX IF NOT EXISTS idx_bulk_capture_status ON public.bulk_capture_progress(status);

-- Enable RLS
ALTER TABLE public.bulk_capture_progress ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (admins only will use this)
CREATE POLICY "Allow all for authenticated users" ON public.bulk_capture_progress
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_bulk_capture_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bulk_capture_updated_at
  BEFORE UPDATE ON public.bulk_capture_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_bulk_capture_updated_at();