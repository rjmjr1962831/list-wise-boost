-- Fix admin login by allowing users to read their own roles
-- This fixes the catch-22 where you can't check if you're an admin without already being an admin

-- Add policy for users to read their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

-- Comment explaining the fix
COMMENT ON POLICY "Users can view their own roles" ON public.user_roles IS 
'Allows users to check their own role during login. Without this, the login flow cannot verify admin access.';
