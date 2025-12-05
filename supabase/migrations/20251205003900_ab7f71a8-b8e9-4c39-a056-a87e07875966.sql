-- Create the actual trigger that fires on professionals table changes
-- This was missing - the function existed but wasn't attached!

DROP TRIGGER IF EXISTS trigger_pipedrive_sync_queue ON public.professionals;

CREATE TRIGGER trigger_pipedrive_sync_queue
  AFTER INSERT OR UPDATE ON public.professionals
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_professional_for_pipedrive_sync();