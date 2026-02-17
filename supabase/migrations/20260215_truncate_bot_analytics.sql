-- Reset bot analytics: clear all rows from cloudflare_request_logs.
-- Run once to zero out the Bot Analytics Dashboard. New logs will accumulate after this.

TRUNCATE TABLE public.cloudflare_request_logs;
