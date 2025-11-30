-- Enable pg_net extension for async HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to sync professional to Pipedrive via edge function
CREATE OR REPLACE FUNCTION public.trigger_pipedrive_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  service_role_key text;
  supabase_url text;
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

  -- Get Supabase credentials from vault or environment
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- Fallback to edge function environment
  IF supabase_url IS NULL THEN
    supabase_url := 'https://bgdtekbhelormzbymkhh.supabase.co';
  END IF;

  -- Make async HTTP request to sync edge function
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/sync-single-professional',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
    ),
    body := jsonb_build_object(
      'professional_id', NEW.id
    ),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sync_professional_to_pipedrive ON public.professionals;

-- Create trigger on professionals table
CREATE TRIGGER sync_professional_to_pipedrive
  AFTER INSERT OR UPDATE ON public.professionals
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_pipedrive_sync();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA net TO postgres, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA net TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA net TO postgres, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA net TO postgres, service_role;