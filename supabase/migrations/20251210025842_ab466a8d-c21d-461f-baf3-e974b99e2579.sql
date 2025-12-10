-- Allow anyone to find their profile by verification_token (for magic link access)
-- This is a limited SELECT that only works when matching their specific token
CREATE POLICY "Anyone can find their profile by verification_token" ON public.professionals
FOR SELECT USING (
  verification_token IS NOT NULL AND 
  verification_token = current_setting('request.headers', true)::json->>'x-verification-token'
);