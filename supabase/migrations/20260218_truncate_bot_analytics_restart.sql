-- Purge all bot analytics data; restart from 0.
-- Run in SQL Editor or via migration. Bot Analytics Dashboard will show zeros until new logs arrive.

TRUNCATE TABLE public.cloudflare_request_logs;
TRUNCATE TABLE public.agent_bot_visit_summary;
