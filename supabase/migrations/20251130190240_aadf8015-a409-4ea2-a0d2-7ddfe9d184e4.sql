-- Create pipedrive sync queue table
CREATE TABLE IF NOT EXISTS public.pipedrive_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  next_retry_at timestamptz,
  UNIQUE(professional_id, status)
);

-- Create index for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_pipedrive_sync_queue_status_next_retry 
ON public.pipedrive_sync_queue(status, next_retry_at) 
WHERE status IN ('pending', 'failed');

-- Enable RLS
ALTER TABLE public.pipedrive_sync_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for admins
CREATE POLICY "Admins can manage sync queue"
ON public.pipedrive_sync_queue
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Function to enqueue professional for sync
CREATE OR REPLACE FUNCTION public.enqueue_professional_for_pipedrive_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip if sync flag is set
  IF NEW.skip_pipedrive_sync = TRUE THEN
    NEW.skip_pipedrive_sync = FALSE;
    RETURN NEW;
  END IF;

  -- Skip if only skip_pipedrive_sync changed
  IF (OLD IS NOT NULL AND 
      NEW.skip_pipedrive_sync IS DISTINCT FROM OLD.skip_pipedrive_sync AND
      ROW(NEW.*) = ROW(OLD.*)) THEN
    RETURN NEW;
  END IF;

  -- Insert or update queue entry
  INSERT INTO public.pipedrive_sync_queue (professional_id, status, attempts, next_retry_at)
  VALUES (NEW.id, 'pending', 0, now())
  ON CONFLICT (professional_id, status) 
  WHERE status = 'pending'
  DO UPDATE SET 
    updated_at = now(),
    next_retry_at = now();

  RETURN NEW;
END;
$$;

-- Create trigger on professionals table
DROP TRIGGER IF EXISTS trigger_enqueue_pipedrive_sync ON public.professionals;
CREATE TRIGGER trigger_enqueue_pipedrive_sync
AFTER INSERT OR UPDATE ON public.professionals
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_professional_for_pipedrive_sync();

-- Function to update queue timestamp
CREATE OR REPLACE FUNCTION public.update_pipedrive_sync_queue_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger to auto-update timestamp
CREATE TRIGGER update_pipedrive_sync_queue_updated_at
BEFORE UPDATE ON public.pipedrive_sync_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_pipedrive_sync_queue_timestamp();