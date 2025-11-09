-- Fix search_path for the update function by dropping trigger first
DROP TRIGGER IF EXISTS update_rate_limits_updated_at ON public.rate_limits;
DROP FUNCTION IF EXISTS public.update_rate_limits_updated_at();

-- Recreate function with proper search_path
CREATE OR REPLACE FUNCTION public.update_rate_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public;

-- Recreate trigger
CREATE TRIGGER update_rate_limits_updated_at
BEFORE UPDATE ON public.rate_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_rate_limits_updated_at();