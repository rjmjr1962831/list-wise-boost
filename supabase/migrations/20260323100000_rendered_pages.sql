-- Server-side render cache for clean-room HTML pages.
-- The Vercel proxy checks this table before calling edge functions.
-- Pages are re-rendered on cache miss or when created_at > 24 hours old.
CREATE TABLE IF NOT EXISTS rendered_pages (
  path TEXT PRIMARY KEY,
  html_content TEXT NOT NULL,
  page_type TEXT NOT NULL DEFAULT 'list',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rendered_pages_type ON rendered_pages(page_type);
ALTER TABLE rendered_pages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY service_role_all ON rendered_pages FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
