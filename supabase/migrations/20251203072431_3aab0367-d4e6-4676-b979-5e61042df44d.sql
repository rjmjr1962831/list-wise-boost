-- Drop existing trigger (correct name)
DROP TRIGGER IF EXISTS trigger_enqueue_pipedrive_sync ON public.professionals;

-- Drop function with CASCADE to handle any remaining dependencies
DROP FUNCTION IF EXISTS public.enqueue_professional_for_pipedrive_sync() CASCADE;

-- Create new smart trigger function that only fires on key CRM field changes
CREATE OR REPLACE FUNCTION public.enqueue_professional_for_pipedrive_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Skip if sync flag is set
  IF NEW.skip_pipedrive_sync = TRUE THEN
    NEW.skip_pipedrive_sync = FALSE;
    RETURN NEW;
  END IF;

  -- For INSERT, always queue
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.pipedrive_sync_queue (professional_id, status, attempts, next_retry_at)
    VALUES (NEW.id, 'pending', 0, now())
    ON CONFLICT (professional_id) 
    WHERE status = 'pending'
    DO UPDATE SET updated_at = now(), next_retry_at = now();
    RETURN NEW;
  END IF;

  -- For UPDATE, only queue if key CRM fields changed
  IF TG_OP = 'UPDATE' THEN
    -- Check if any key fields changed
    IF (
      OLD.name IS DISTINCT FROM NEW.name OR
      OLD.email IS DISTINCT FROM NEW.email OR
      OLD.phone IS DISTINCT FROM NEW.phone OR
      OLD.company IS DISTINCT FROM NEW.company OR
      OLD.business_name IS DISTINCT FROM NEW.business_name OR
      OLD.claim_status IS DISTINCT FROM NEW.claim_status OR
      OLD.active IS DISTINCT FROM NEW.active OR
      OLD.funnel_status IS DISTINCT FROM NEW.funnel_status OR
      OLD.license_number IS DISTINCT FROM NEW.license_number OR
      OLD.profile_link IS DISTINCT FROM NEW.profile_link
    ) THEN
      INSERT INTO public.pipedrive_sync_queue (professional_id, status, attempts, next_retry_at)
      VALUES (NEW.id, 'pending', 0, now())
      ON CONFLICT (professional_id) 
      WHERE status = 'pending'
      DO UPDATE SET updated_at = now(), next_retry_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER trigger_enqueue_pipedrive_sync
AFTER INSERT OR UPDATE ON public.professionals
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_professional_for_pipedrive_sync();