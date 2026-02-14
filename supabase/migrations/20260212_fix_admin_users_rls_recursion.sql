-- Fix infinite recursion in admin_users RLS policy
-- The login flow queries admin_users to check roles. If the policy checks admin_users
-- (e.g. "admins can view" where "admin" is determined by querying admin_users), recursion occurs.
--
-- Solution: Replace all policies with one that allows users to read their OWN row only.
-- Using (id = auth.uid()) does not query admin_users, so no recursion.

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop all existing policies on admin_users (they may cause recursion)
  FOR r IN (
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_users'
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.admin_users', r.policyname);
  END LOOP;
END $$;

-- Create policy: users can read their own row (for login/role check)
CREATE POLICY "Users can view their own admin record"
ON public.admin_users
FOR SELECT
TO authenticated
USING (id = auth.uid());

COMMENT ON POLICY "Users can view their own admin record" ON public.admin_users IS
'Allows users to check their own admin status during login. Prevents infinite recursion.';
