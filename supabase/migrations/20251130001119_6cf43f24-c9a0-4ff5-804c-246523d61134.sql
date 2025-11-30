-- Fix search_path for the new function (use CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION update_bulk_capture_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;