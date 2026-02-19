-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/wiotrvoirdgzfacuuiem/sql
-- Fixes: log-bot-visit 500 "Could not find the 'host' column"

ALTER TABLE public.cloudflare_request_logs
  ADD COLUMN IF NOT EXISTS host text;

COMMENT ON COLUMN public.cloudflare_request_logs.host IS 'Request host from Cloudflare (e.g. www.top10lists.us)';
