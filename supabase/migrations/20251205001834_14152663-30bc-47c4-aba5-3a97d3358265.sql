-- Table to cache organization IDs (avoid repeated lookups)
CREATE TABLE IF NOT EXISTS public.pipedrive_org_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name text NOT NULL UNIQUE,
  pipedrive_org_id integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table to track sync state per professional (change detection)
CREATE TABLE IF NOT EXISTS public.pipedrive_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL UNIQUE REFERENCES public.professionals(id) ON DELETE CASCADE,
  pipedrive_person_id integer,
  last_sync_hash text,
  last_synced_at timestamptz,
  last_synced_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipedrive_org_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipedrive_sync_state ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin access
CREATE POLICY "Admins can manage org cache" ON public.pipedrive_org_cache
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage sync state" ON public.pipedrive_sync_state
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes for performance
CREATE INDEX idx_pipedrive_org_cache_name ON public.pipedrive_org_cache(org_name);
CREATE INDEX idx_pipedrive_sync_state_professional ON public.pipedrive_sync_state(professional_id);
CREATE INDEX idx_pipedrive_sync_state_person ON public.pipedrive_sync_state(pipedrive_person_id);