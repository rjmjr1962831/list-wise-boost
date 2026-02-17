-- Clear all bot analytics data for a fresh start
-- Run this when you want to reset bot tracking

TRUNCATE TABLE public.cloudflare_request_logs;
TRUNCATE TABLE public.agent_bot_visit_summary;
