-- Remove permissive public SELECT from professionals base table
-- Keep admin-only access to base table; public reads go through professionals_public view

DROP POLICY IF EXISTS "Anyone can view active professionals" ON public.professionals;

-- Admin-only SELECT on base table
CREATE POLICY "Admins can view all professionals" ON public.professionals
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));