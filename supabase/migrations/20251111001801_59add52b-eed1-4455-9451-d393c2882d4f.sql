-- Remove public access policy from rate_limits table
DROP POLICY IF EXISTS "Allow public access for rate limiting" ON public.rate_limits;

-- Add admin-only policy for managing rate limits
-- Note: Edge functions using service role key will bypass RLS automatically
CREATE POLICY "Admins can manage rate limits"
ON public.rate_limits
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));