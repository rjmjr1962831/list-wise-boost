-- Step 7b: Remove the overly permissive contacts policy (now that admin policy is in place)
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON public.contacts;

-- Step 9: Fix agent_applications - Remove user SELECT policy
-- Users should only INSERT, not view all applications
DROP POLICY IF EXISTS "Users can view their own applications" ON public.agent_applications;