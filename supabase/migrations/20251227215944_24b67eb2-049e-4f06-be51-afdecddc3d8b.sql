-- Step 2A: Delete duplicate Pipedrive triggers
DROP TRIGGER IF EXISTS trigger_enqueue_pipedrive_sync ON professionals;
DROP TRIGGER IF EXISTS trigger_pipedrive_sync_queue ON professionals;
DROP TRIGGER IF EXISTS sync_professional_to_pipedrive ON professionals;
DROP TRIGGER IF EXISTS trigger_sync_professional_to_pipedrive ON professionals;