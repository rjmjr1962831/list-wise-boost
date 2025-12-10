-- =============================================================================
-- EMERGENCY SECURITY ROLLBACK SCRIPT
-- Created: 2025-12-10
-- Purpose: Reverse all security changes if something breaks
-- =============================================================================

-- HOW TO USE:
-- 1. If any part of the security remediation breaks the app, run relevant sections below
-- 2. Each section can be run independently
-- 3. After rollback, investigate the issue before re-attempting

-- =============================================================================
-- STEP 1 ROLLBACK: Recreate prerender_recache_jobs table (if needed)
-- =============================================================================
-- Note: This table was legacy/unused. Only recreate if absolutely necessary.
/*
CREATE TABLE IF NOT EXISTS public.prerender_recache_jobs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    total_urls integer NOT NULL DEFAULT 0,
    processed_count integer NOT NULL DEFAULT 0,
    success_count integer NOT NULL DEFAULT 0,
    fail_count integer NOT NULL DEFAULT 0,
    current_index integer NOT NULL DEFAULT 0,
    urls jsonb NOT NULL DEFAULT '[]'::jsonb,
    results jsonb NOT NULL DEFAULT '[]'::jsonb,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    error_message text,
    status text NOT NULL DEFAULT 'pending'::text
);

ALTER TABLE public.prerender_recache_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage prerender jobs" ON public.prerender_recache_jobs
FOR ALL USING (true) WITH CHECK (true);
*/

-- =============================================================================
-- STEP 2 ROLLBACK: Drop professionals_public view
-- =============================================================================
DROP VIEW IF EXISTS public.professionals_public;

-- =============================================================================
-- STEP 5-6 ROLLBACK: Restore permissive policy on professionals table
-- =============================================================================
-- First, remove the restrictive policy if it exists
DROP POLICY IF EXISTS "Restrict base table to admins" ON public.professionals;

-- Recreate the original permissive policy
CREATE POLICY "Anyone can view active professionals" ON public.professionals
FOR SELECT USING (active = true);

-- =============================================================================
-- STEP 7 ROLLBACK: Restore contacts table to original state
-- =============================================================================
DROP POLICY IF EXISTS "Admins can view contacts" ON public.contacts;

CREATE POLICY "Authenticated users can view contacts" ON public.contacts
FOR SELECT USING (true);

-- =============================================================================
-- STEP 8 ROLLBACK: Remove review_requests policies
-- =============================================================================
DROP POLICY IF EXISTS "Admins can manage review requests" ON public.review_requests;
DROP POLICY IF EXISTS "Anyone can submit review requests" ON public.review_requests;

-- =============================================================================
-- STEP 9 ROLLBACK: Restore agent_applications user SELECT policy
-- =============================================================================
CREATE POLICY "Users can view their own applications" ON public.agent_applications
FOR SELECT USING (auth.uid() = user_id);

-- =============================================================================
-- VERIFICATION QUERIES
-- Run these to verify rollback was successful
-- =============================================================================

-- Check professionals policies
-- SELECT policyname, cmd, permissive, qual FROM pg_policies WHERE tablename = 'professionals';

-- Check contacts policies  
-- SELECT policyname, cmd, permissive, qual FROM pg_policies WHERE tablename = 'contacts';

-- Check review_requests policies
-- SELECT policyname, cmd, permissive, qual FROM pg_policies WHERE tablename = 'review_requests';

-- Check agent_applications policies
-- SELECT policyname, cmd, permissive, qual FROM pg_policies WHERE tablename = 'agent_applications';

-- Check if professionals_public view exists (should NOT exist after rollback)
-- SELECT * FROM information_schema.views WHERE table_name = 'professionals_public';
