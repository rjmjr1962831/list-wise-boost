-- Fix CRM agent lookup: Allow admin_users (admin/superadmin) to SELECT from professionals.
-- CRM uses admin_users for auth; professionals RLS used has_role() which checks user_roles.
-- If a user is in admin_users but not user_roles, they could log into CRM but get no results.
-- This policy aligns professionals RLS with CRM auth.

CREATE POLICY "Admin users can view all professionals"
ON public.professionals
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.id = auth.uid()
    AND admin_users.active = true
    AND admin_users.role IN ('admin', 'superadmin')
  )
);

COMMENT ON POLICY "Admin users can view all professionals" ON public.professionals IS
'Allows CRM admins (admin_users) to search and view professionals. CRM auth uses admin_users; this keeps RLS in sync.';
