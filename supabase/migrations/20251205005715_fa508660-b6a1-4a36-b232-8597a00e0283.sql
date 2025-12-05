-- Disable the Pipedrive sync trigger to prevent automatic syncing
DROP TRIGGER IF EXISTS enqueue_pipedrive_sync ON professionals;