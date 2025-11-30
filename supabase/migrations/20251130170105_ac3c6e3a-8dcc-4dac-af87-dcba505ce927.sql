-- Add a column to track if we're in a sync operation to prevent loops
ALTER TABLE professionals 
ADD COLUMN IF NOT EXISTS skip_pipedrive_sync BOOLEAN DEFAULT FALSE;

-- Create function to sync professional to Pipedrive
CREATE OR REPLACE FUNCTION sync_professional_to_pipedrive()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Skip if this is a sync operation from Pipedrive
  IF NEW.skip_pipedrive_sync = TRUE THEN
    NEW.skip_pipedrive_sync = FALSE;
    RETURN NEW;
  END IF;

  -- Skip if only skip_pipedrive_sync flag changed
  IF (OLD IS NOT NULL AND 
      NEW.skip_pipedrive_sync IS DISTINCT FROM OLD.skip_pipedrive_sync AND
      NEW = OLD) THEN
    RETURN NEW;
  END IF;

  -- Call edge function asynchronously to sync to Pipedrive
  -- Using pg_net extension or similar would be ideal here
  -- For now, we'll rely on manual triggering or scheduled jobs
  
  RETURN NEW;
END;
$$;

-- Create trigger on professionals table
DROP TRIGGER IF EXISTS trigger_sync_professional_to_pipedrive ON professionals;
CREATE TRIGGER trigger_sync_professional_to_pipedrive
  AFTER INSERT OR UPDATE ON professionals
  FOR EACH ROW
  EXECUTE FUNCTION sync_professional_to_pipedrive();