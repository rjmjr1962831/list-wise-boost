-- Disable the Pipedrive sync trigger to stop automatic syncing
DROP TRIGGER IF EXISTS enqueue_pipedrive_sync ON public.professionals;
DROP TRIGGER IF EXISTS trigger_pipedrive_sync ON public.professionals;