-- Database Trigger: Sync CRM changes to Instantly.ai
-- This trigger fires when professionals table is updated
-- and automatically syncs changes to Instantly

-- Create function that calls the Edge Function
CREATE OR REPLACE FUNCTION trigger_sync_to_instantly()
RETURNS TRIGGER AS $$
DECLARE
  payload jsonb;
  request_id bigint;
BEGIN
  -- Only sync if agent has an email
  IF NEW.email IS NOT NULL THEN
    
    -- Determine action type
    IF TG_OP = 'INSERT' THEN
      payload := jsonb_build_object(
        'professional_id', NEW.id,
        'action', 'add'
      );
    ELSIF TG_OP = 'UPDATE' THEN
      payload := jsonb_build_object(
        'professional_id', NEW.id,
        'action', 'update'
      );
    ELSIF TG_OP = 'DELETE' THEN
      payload := jsonb_build_object(
        'professional_id', OLD.id,
        'action', 'delete'
      );
    END IF;

    -- Call the Edge Function asynchronously via pg_net
    -- Note: This requires pg_net extension
    SELECT net.http_post(
      url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/sync-crm-to-instantly',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body := payload
    ) INTO request_id;

    -- Log the sync attempt
    RAISE NOTICE 'Instantly sync queued for professional %: request_id %', 
      COALESCE(NEW.id, OLD.id), request_id;
    
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS professionals_sync_to_instantly ON professionals;

-- Create trigger on professionals table
CREATE TRIGGER professionals_sync_to_instantly
  AFTER INSERT OR UPDATE OF 
    name, email, phone, state_slug, served_cities, company, business_name,
    funnel_status, review_stars_rating, num_total_reviews, specialty,
    canonical_slug, business_city, business_state
  ON professionals
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_to_instantly();

-- Optional: Create trigger for DELETE operations
-- Uncomment if you want to remove leads from Instantly when deleted from CRM
-- CREATE TRIGGER professionals_delete_from_instantly
--   BEFORE DELETE ON professionals
--   FOR EACH ROW
--   EXECUTE FUNCTION trigger_sync_to_instantly();

COMMENT ON TRIGGER professionals_sync_to_instantly ON professionals IS 
  'Automatically syncs professional changes to Instantly.ai via Edge Function';

COMMENT ON FUNCTION trigger_sync_to_instantly() IS 
  'Calls sync-crm-to-instantly Edge Function when professionals table changes';
