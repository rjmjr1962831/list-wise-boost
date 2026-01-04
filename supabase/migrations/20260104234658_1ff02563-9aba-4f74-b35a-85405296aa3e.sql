-- Phase 1A: Schema Changes for Canonical Agent URL Migration

-- Step 1A.1: Add New Columns to professionals Table
ALTER TABLE public.professionals
ADD COLUMN IF NOT EXISTS canonical_slug TEXT,
ADD COLUMN IF NOT EXISTS state_slug TEXT,
ADD COLUMN IF NOT EXISTS served_cities TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS paid_cities TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS free_pool_position INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS legacy_url_slug TEXT;

-- Step 1A.2: Create Canonical Slug Generator Function
CREATE OR REPLACE FUNCTION public.generate_canonical_slug(full_name TEXT, phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  name_parts TEXT[];
  first_name TEXT;
  last_name TEXT;
  clean_first TEXT;
  clean_last TEXT;
  phone_digits TEXT;
  result TEXT;
BEGIN
  -- Handle null or empty name
  IF full_name IS NULL OR trim(full_name) = '' THEN
    RETURN NULL;
  END IF;

  -- Extract last 4 digits of phone (or use 0000 if null/short)
  IF phone IS NULL OR phone = '' THEN
    phone_digits := '0000';
  ELSE
    -- Remove all non-digits
    phone_digits := regexp_replace(phone, '[^0-9]', '', 'g');
    -- Get last 4 digits, pad with zeros if too short
    IF length(phone_digits) >= 4 THEN
      phone_digits := right(phone_digits, 4);
    ELSE
      phone_digits := lpad(phone_digits, 4, '0');
    END IF;
  END IF;

  -- Split name into parts
  name_parts := regexp_split_to_array(trim(full_name), '\s+');

  -- Get first and last name
  first_name := name_parts[1];
  IF array_length(name_parts, 1) > 1 THEN
    last_name := name_parts[array_length(name_parts, 1)];
  ELSE
    last_name := NULL;
  END IF;

  -- Clean first name: lowercase, remove accents, keep only alphanumeric and hyphens
  clean_first := lower(unaccent(first_name));
  clean_first := regexp_replace(clean_first, '[^a-z0-9-]', '', 'g');

  -- Clean last name if exists
  IF last_name IS NOT NULL THEN
    clean_last := lower(unaccent(last_name));
    clean_last := regexp_replace(clean_last, '[^a-z0-9-]', '', 'g');
    result := clean_first || '-' || clean_last || '-' || phone_digits;
  ELSE
    result := clean_first || '-' || phone_digits;
  END IF;

  RETURN result;
END;
$$;

-- Step 1A.3: Create Index for Fast Lookups
CREATE INDEX IF NOT EXISTS idx_professionals_canonical_lookup 
ON public.professionals (state_slug, canonical_slug) 
WHERE active = true;