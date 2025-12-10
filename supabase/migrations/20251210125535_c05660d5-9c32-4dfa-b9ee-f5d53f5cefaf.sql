-- Add short_code column to professionals table
ALTER TABLE public.professionals 
ADD COLUMN short_code text UNIQUE;

-- Create index for fast lookups
CREATE INDEX idx_professionals_short_code ON public.professionals(short_code);

-- Function to generate random 6-character alphanumeric code
CREATE OR REPLACE FUNCTION generate_short_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Generate short codes for all existing professionals that don't have one
DO $$
DECLARE
  prof RECORD;
  new_code text;
  code_exists boolean;
BEGIN
  FOR prof IN SELECT id FROM public.professionals WHERE short_code IS NULL LOOP
    LOOP
      new_code := generate_short_code();
      SELECT EXISTS(SELECT 1 FROM public.professionals WHERE short_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    UPDATE public.professionals SET short_code = new_code WHERE id = prof.id;
  END LOOP;
END $$;

-- Update profile_link to use short URL format for all professionals with short_code
UPDATE public.professionals 
SET profile_link = 'https://top10lists.us/p/' || short_code
WHERE short_code IS NOT NULL;

-- Create trigger to auto-generate short_code on insert
CREATE OR REPLACE FUNCTION auto_generate_short_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  IF NEW.short_code IS NULL THEN
    LOOP
      new_code := generate_short_code();
      SELECT EXISTS(SELECT 1 FROM public.professionals WHERE short_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.short_code := new_code;
    NEW.profile_link := 'https://top10lists.us/p/' || new_code;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_generate_short_code_trigger
BEFORE INSERT ON public.professionals
FOR EACH ROW
EXECUTE FUNCTION auto_generate_short_code();