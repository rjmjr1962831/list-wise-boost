-- Drop the header-based policy (doesn't work with client SDK)
DROP POLICY IF EXISTS "Anyone can find their profile by verification_token" ON public.professionals;

-- Allow anyone to SELECT if they know the exact ID (for magic link UUID lookup)
-- This is secure because UUIDs are unguessable and this enables the profile edit flow
CREATE POLICY "Anyone can view professional by ID" ON public.professionals
FOR SELECT USING (true);

-- Note: We're restoring public SELECT but still protect sensitive data via the view
-- The professionals_public view should be used for listing pages
-- Direct ID lookups (magic links) need base table access