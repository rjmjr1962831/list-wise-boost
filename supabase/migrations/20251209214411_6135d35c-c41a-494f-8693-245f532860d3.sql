-- Add partial unique index for ON CONFLICT to work properly
-- The trigger uses: ON CONFLICT (professional_id) WHERE status = 'pending'
-- But needs this exact index to match

CREATE UNIQUE INDEX IF NOT EXISTS idx_pipedrive_sync_queue_pending_professional
ON public.pipedrive_sync_queue (professional_id) 
WHERE status = 'pending';