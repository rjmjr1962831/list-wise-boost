-- ============================================================
-- VERIFICATION: Check RLS status and policies on all 12 tables
-- Run this BEFORE and AFTER each step to confirm state.
-- ============================================================

-- 1. RLS enabled/disabled status
SELECT
  t.tablename,
  t.rowsecurity AS rls_enabled,
  COALESCE(p.policy_count, 0) AS policy_count
FROM pg_tables t
LEFT JOIN (
  SELECT tablename, COUNT(*) AS policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
) p ON t.tablename = p.tablename
WHERE t.schemaname = 'public'
  AND t.tablename IN (
    'rate_limits', 'agent_sessions', 'pipedrive_sync_queue',
    'appointments', 'arizona_licenses', 'pipedrive_field_mapping',
    'pipedrive_sync_state', 'professional_cities',
    'canonical_city_rankings', 'funnel_events', 'contacts',
    'enrichment_queue'
  )
ORDER BY t.tablename;

-- 2. List all policies on these tables (empty before we start)
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'rate_limits', 'agent_sessions', 'pipedrive_sync_queue',
    'appointments', 'arizona_licenses', 'pipedrive_field_mapping',
    'pipedrive_sync_state', 'professional_cities',
    'canonical_city_rankings', 'funnel_events', 'contacts',
    'enrichment_queue'
  )
ORDER BY tablename, policyname;

-- 3. Quick smoke test: confirm public reads still work
-- (run after Step 2 to verify city pages aren't broken)
SELECT COUNT(*) AS professional_cities_count FROM public.professional_cities;
SELECT COUNT(*) AS canonical_rankings_count FROM public.canonical_city_rankings;
