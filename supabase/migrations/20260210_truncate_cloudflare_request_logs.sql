-- Purge all bot analytics data; restart tracking from now
TRUNCATE TABLE public.cloudflare_request_logs;
