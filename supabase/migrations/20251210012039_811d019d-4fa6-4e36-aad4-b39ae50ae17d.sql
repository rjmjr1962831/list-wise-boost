-- Step 1: Drop legacy prerender_recache_jobs table (not used - Cloudflare KV caching is active)
DROP TABLE IF EXISTS public.prerender_recache_jobs;