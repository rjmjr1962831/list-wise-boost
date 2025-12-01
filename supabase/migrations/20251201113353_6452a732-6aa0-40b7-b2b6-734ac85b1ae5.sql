-- Create canonical_city_rankings table for stable bot-served content
CREATE TABLE IF NOT EXISTS public.canonical_city_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(city_id, category_id, professional_id)
);

-- Create index for fast lookups
CREATE INDEX idx_canonical_rankings_city_category ON public.canonical_city_rankings(city_id, category_id, rank);
CREATE INDEX idx_canonical_rankings_professional ON public.canonical_city_rankings(professional_id);

-- Create cache_invalidation_queue table
CREATE TABLE IF NOT EXISTS public.cache_invalidation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  CONSTRAINT cache_invalidation_queue_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Create index for queue processing
CREATE INDEX idx_cache_queue_status ON public.cache_invalidation_queue(status, created_at);

-- Enable RLS
ALTER TABLE public.canonical_city_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cache_invalidation_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for canonical_city_rankings
CREATE POLICY "Anyone can view canonical rankings"
  ON public.canonical_city_rankings
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage canonical rankings"
  ON public.canonical_city_rankings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for cache_invalidation_queue
CREATE POLICY "Admins can view cache queue"
  ON public.cache_invalidation_queue
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage cache queue"
  ON public.cache_invalidation_queue
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_canonical_rankings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_canonical_rankings_updated_at
  BEFORE UPDATE ON public.canonical_city_rankings
  FOR EACH ROW
  EXECUTE FUNCTION update_canonical_rankings_updated_at();