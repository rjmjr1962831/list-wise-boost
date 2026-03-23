-- Static pre-rendered pages (crawl-stats, etc.)
CREATE TABLE IF NOT EXISTS static_pages (
  slug TEXT PRIMARY KEY,
  html TEXT NOT NULL,
  rendered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allow edge functions to read/write
ALTER TABLE static_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON static_pages FOR ALL USING (true) WITH CHECK (true);
