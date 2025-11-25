-- Add RLS policy to allow agents to update their own profiles by email match
CREATE POLICY "Professionals can update their profile by email"
ON public.professionals
FOR UPDATE
USING (email = auth.jwt() ->> 'email')
WITH CHECK (email = auth.jwt() ->> 'email');