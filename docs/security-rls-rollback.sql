-- ============================================================
-- ROLLBACK: Disable RLS on all 12 flagged tables
-- Run this if anything breaks after enabling RLS.
-- This restores every table to its current state (RLS off).
-- Safe to run multiple times (idempotent).
-- ============================================================

-- Category A: Edge-function-only tables
ALTER TABLE public.rate_limits DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipedrive_sync_queue DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.arizona_licenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipedrive_field_mapping DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipedrive_sync_state DISABLE ROW LEVEL SECURITY;

-- Category B: Public read tables
ALTER TABLE public.professional_cities DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_city_rankings DISABLE ROW LEVEL SECURITY;

-- Category C: Admin/funnel tables
ALTER TABLE public.funnel_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrichment_queue DISABLE ROW LEVEL SECURITY;

-- Drop all policies we created (IF EXISTS prevents errors if
-- a policy was never created or was already dropped).
-- Category B policies
DROP POLICY IF EXISTS "anon_select_professional_cities" ON public.professional_cities;
DROP POLICY IF EXISTS "anon_select_canonical_city_rankings" ON public.canonical_city_rankings;

-- Category C policies
DROP POLICY IF EXISTS "anon_select_funnel_events" ON public.funnel_events;
DROP POLICY IF EXISTS "anon_insert_funnel_events" ON public.funnel_events;
DROP POLICY IF EXISTS "anon_select_contacts" ON public.contacts;
DROP POLICY IF EXISTS "anon_insert_contacts" ON public.contacts;
DROP POLICY IF EXISTS "anon_select_enrichment_queue" ON public.enrichment_queue;
DROP POLICY IF EXISTS "anon_update_enrichment_queue" ON public.enrichment_queue;

-- ============================================================
-- VERIFICATION: Run after rollback to confirm RLS is off
-- ============================================================
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'rate_limits', 'agent_sessions', 'pipedrive_sync_queue',
    'appointments', 'arizona_licenses', 'pipedrive_field_mapping',
    'pipedrive_sync_state', 'professional_cities',
    'canonical_city_rankings', 'funnel_events', 'contacts',
    'enrichment_queue'
  )
ORDER BY tablename;
-- Expected after rollback: all rows show rowsecurity = false
