-- Add list page context to bot logs: which location (city/neighborhood) was crawled and which agents were shown
ALTER TABLE public.cloudflare_request_logs
  ADD COLUMN IF NOT EXISTS list_page_type text,
  ADD COLUMN IF NOT EXISTS location_display text,
  ADD COLUMN IF NOT EXISTS agents_shown jsonb;

COMMENT ON COLUMN public.cloudflare_request_logs.list_page_type IS 'When path is a list page: city | neighborhood';
COMMENT ON COLUMN public.cloudflare_request_logs.location_display IS 'Human-readable location e.g. Arcadia, Phoenix, AZ or Phoenix, AZ';
COMMENT ON COLUMN public.cloudflare_request_logs.agents_shown IS 'Array of { canonical_slug, name } for agents shown on this list page when crawled';

CREATE INDEX IF NOT EXISTS idx_cf_logs_list_page ON public.cloudflare_request_logs(list_page_type, timestamp DESC) WHERE list_page_type IS NOT NULL;
