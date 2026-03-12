-- Migration: bot_crawl_logs table
-- Tracks AI bot crawls per agent profile for GEO analytics and email merge fields
-- Applied: 2026-03-12

CREATE TABLE IF NOT EXISTS bot_crawl_logs (
  id          BIGSERIAL PRIMARY KEY,
  agent_id    UUID REFERENCES professionals(id) ON DELETE SET NULL,
  page_path   TEXT NOT NULL,
  user_agent  TEXT,
  bot_name    TEXT,
  crawled_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bcl_agent_id   ON bot_crawl_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_bcl_crawled_at ON bot_crawl_logs(crawled_at DESC);
CREATE INDEX IF NOT EXISTS idx_bcl_bot_name   ON bot_crawl_logs(bot_name);

