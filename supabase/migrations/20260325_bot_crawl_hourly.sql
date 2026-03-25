-- bot_crawl_hourly: Axiom-sourced bot crawl counts (12h sync)
-- Replaces bot_crawl_logs for dashboard display queries.
-- bot_crawl_logs remains for per-agent attribution (rollup).

CREATE TABLE IF NOT EXISTS bot_crawl_hourly (
  hour      timestamptz NOT NULL,
  bot_name  text NOT NULL,
  visits    int NOT NULL DEFAULT 0,
  synced_at timestamptz DEFAULT now(),
  PRIMARY KEY (hour, bot_name)
);

-- Index for dashboard range queries
CREATE INDEX IF NOT EXISTS idx_bot_crawl_hourly_hour ON bot_crawl_hourly (hour DESC);

-- RLS: read-only for anon, full access for service role
ALTER TABLE bot_crawl_hourly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_bot_crawl_hourly" ON bot_crawl_hourly FOR SELECT TO anon USING (true);
CREATE POLICY "service_role_all_bot_crawl_hourly" ON bot_crawl_hourly FOR ALL TO service_role USING (true);
