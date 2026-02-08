-- Cloudflare Request Logs Table
-- Stores HTTP request logs pushed from Cloudflare for bot analytics

CREATE TABLE IF NOT EXISTS public.cloudflare_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Request metadata
  timestamp timestamptz NOT NULL,
  client_ip text,
  user_agent text,
  url text NOT NULL,
  path text,
  method text,
  
  -- Cloudflare data
  cache_status text,
  cache_response_status integer,
  country text,
  ray_id text,
  
  -- Bot detection (parsed from user agent)
  bot_type text,
  is_bot boolean DEFAULT false,
  
  -- Full raw log for flexibility
  raw_log jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  
  -- Indexes for common queries
  CONSTRAINT unique_ray_id UNIQUE (ray_id)
);

-- Index on timestamp for time-range queries
CREATE INDEX IF NOT EXISTS idx_cf_logs_timestamp ON public.cloudflare_request_logs(timestamp DESC);

-- Index on bot queries
CREATE INDEX IF NOT EXISTS idx_cf_logs_bot_type ON public.cloudflare_request_logs(bot_type) WHERE bot_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cf_logs_is_bot ON public.cloudflare_request_logs(is_bot) WHERE is_bot = true;

-- Index on URL patterns for agent profile matching
CREATE INDEX IF NOT EXISTS idx_cf_logs_path ON public.cloudflare_request_logs(path) WHERE path LIKE '%/top10realestateagents%';

-- Composite index for bot analytics queries
CREATE INDEX IF NOT EXISTS idx_cf_logs_bot_time ON public.cloudflare_request_logs(bot_type, timestamp DESC) WHERE is_bot = true;

-- RLS: Allow service role and authenticated users to read
ALTER TABLE public.cloudflare_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert logs"
  ON public.cloudflare_request_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read logs"
  ON public.cloudflare_request_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Comments
COMMENT ON TABLE public.cloudflare_request_logs IS 'HTTP request logs from Cloudflare for bot analytics and traffic analysis';
COMMENT ON COLUMN public.cloudflare_request_logs.bot_type IS 'Detected bot type: googlebot, claudebot, etc.';
COMMENT ON COLUMN public.cloudflare_request_logs.cache_status IS 'Cloudflare cache status: HIT, MISS, DYNAMIC';
COMMENT ON COLUMN public.cloudflare_request_logs.path IS 'URL path for matching to agent profiles';
