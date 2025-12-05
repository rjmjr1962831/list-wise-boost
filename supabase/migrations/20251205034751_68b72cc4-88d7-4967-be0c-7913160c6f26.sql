-- Re-enable Pipedrive sync trigger on professionals table
CREATE TRIGGER enqueue_professional_for_pipedrive_sync_trigger
  AFTER INSERT OR UPDATE ON public.professionals
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_professional_for_pipedrive_sync();