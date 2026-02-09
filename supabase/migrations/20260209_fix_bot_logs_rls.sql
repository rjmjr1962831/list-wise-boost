-- Fix RLS policy to allow anon users to read bot logs (needed for public dashboards)
CREATE POLICY "Anon users can read bot logs"
  ON public.cloudflare_request_logs
  FOR SELECT
  TO anon
  USING (is_bot = true);

-- Also allow anon users to call the bot stats function
-- (already granted but adding comment for clarity)
COMMENT ON FUNCTION get_bot_stats(timestamptz) IS 'Public function - can be called by anon and authenticated users';
