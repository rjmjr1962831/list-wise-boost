-- Create cache table for city agent counts
CREATE TABLE IF NOT EXISTS public.city_agent_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_slug TEXT UNIQUE NOT NULL,
  city_name TEXT NOT NULL,
  agent_count INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_city_agent_counts_slug ON public.city_agent_counts(city_slug);

-- Enable RLS
ALTER TABLE public.city_agent_counts ENABLE ROW LEVEL SECURITY;

-- Anyone can read counts (public data for SEO)
CREATE POLICY "Allow public read access" ON public.city_agent_counts
  FOR SELECT USING (true);

-- Only service role can manage (via edge function)
CREATE POLICY "Service role can manage city counts" ON public.city_agent_counts
  FOR ALL USING (true);