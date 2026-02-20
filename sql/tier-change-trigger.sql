-- Tier Change Webhook Trigger
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- Requires pg_net extension (already enabled in most Supabase projects)

-- Enable pg_net if not already
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Trigger function: fires edge function when current_tier changes
CREATE OR REPLACE FUNCTION notify_tier_change()
RETURNS TRIGGER AS $$
DECLARE
  old_tier TEXT;
  new_tier TEXT;
  payload JSONB;
BEGIN
  old_tier := COALESCE(OLD.current_tier, OLD.badge_tier, 'listed');
  new_tier := COALESCE(NEW.current_tier, NEW.badge_tier, 'listed');

  -- Only fire if tier actually changed
  IF old_tier = new_tier THEN
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'type', 'UPDATE',
    'table', 'professionals',
    'schema', 'public',
    'record', jsonb_build_object(
      'id', NEW.id,
      'name', NEW.name,
      'city_id', NEW.city_id,
      'current_tier', NEW.current_tier,
      'badge_tier', NEW.badge_tier
    ),
    'old_record', jsonb_build_object(
      'id', OLD.id,
      'name', OLD.name,
      'city_id', OLD.city_id,
      'current_tier', OLD.current_tier,
      'badge_tier', OLD.badge_tier
    )
  );

  -- Call the edge function via pg_net
  PERFORM net.http_post(
    url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/tier-change-webhook',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := payload
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger (drop first if exists)
DROP TRIGGER IF EXISTS on_tier_change ON professionals;

CREATE TRIGGER on_tier_change
  AFTER UPDATE OF current_tier, badge_tier
  ON professionals
  FOR EACH ROW
  EXECUTE FUNCTION notify_tier_change();

-- Verify
SELECT 'Trigger created successfully. Tier changes on professionals will now auto-regenerate clean-room pages.' AS status;
