-- Verify and grant admin access for robert@aryah.ai
-- Run this in Supabase SQL Editor

-- First, let's find the user ID
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at
FROM auth.users
WHERE email = 'robert@aryah.ai';

-- Check current roles for this user
SELECT 
    ur.user_id,
    ur.role,
    ur.created_at
FROM public.user_roles ur
JOIN auth.users u ON ur.user_id = u.id
WHERE u.email = 'robert@aryah.ai';

-- Grant admin role if not exists
-- Replace 'USER_ID_HERE' with the actual user ID from the first query
-- Or run this directly if you want to auto-grant:
INSERT INTO public.user_roles (user_id, role)
SELECT 
    id,
    'admin'
FROM auth.users
WHERE email = 'robert@aryah.ai'
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify the role was added
SELECT 
    u.email,
    ur.role,
    ur.created_at
FROM public.user_roles ur
JOIN auth.users u ON ur.user_id = u.id
WHERE u.email = 'robert@aryah.ai';
