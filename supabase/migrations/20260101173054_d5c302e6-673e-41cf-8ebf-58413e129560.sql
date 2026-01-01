-- Allow inserts to funnel_events from edge functions (service role)
-- The table already has admin SELECT policy, but needs INSERT for tracking

CREATE POLICY "Allow insert for service role and edge functions"
ON public.funnel_events
FOR INSERT
WITH CHECK (true);