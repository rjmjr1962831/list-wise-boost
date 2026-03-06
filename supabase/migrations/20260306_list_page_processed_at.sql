-- Support batch processing of list-page rows: one row per request, per-agent rows created by a job.
-- Enables scale (50 agents per page, ~1000+ requests/day) without doing 50 inserts on the request path.

ALTER TABLE public.cloudflare_request_logs
  ADD COLUMN IF NOT EXISTS list_page_processed_at timestamptz;

COMMENT ON COLUMN public.cloudflare_request_logs.list_page_processed_at IS
  'Set by batch job when per-agent rows have been created from this list-page row. Null = not yet processed.';

CREATE INDEX IF NOT EXISTS idx_cf_logs_list_page_unprocessed
  ON public.cloudflare_request_logs(created_at)
  WHERE agents_shown IS NOT NULL AND agent_id IS NULL AND list_page_processed_at IS NULL;
