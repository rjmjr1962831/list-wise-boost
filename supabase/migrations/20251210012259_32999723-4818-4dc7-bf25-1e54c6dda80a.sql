-- Step 7: Fix contacts table - Add admin-only SELECT policy
-- (We'll remove the permissive one after verifying this works)
CREATE POLICY "Admins can view contacts" ON public.contacts
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Step 8: Fix review_requests table - Add policies (it has ZERO policies currently)
ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage review requests" ON public.review_requests
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can submit review requests" ON public.review_requests
FOR INSERT WITH CHECK (true);