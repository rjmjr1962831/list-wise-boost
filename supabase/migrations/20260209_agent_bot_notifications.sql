-- Add agent_id column to cloudflare_request_logs for tracking which agent was viewed
ALTER TABLE public.cloudflare_request_logs
ADD COLUMN IF NOT EXISTS agent_id uuid;

-- Create index for agent-specific queries
CREATE INDEX IF NOT EXISTS idx_cf_logs_agent_bot ON public.cloudflare_request_logs(agent_id, is_bot, timestamp DESC) WHERE is_bot = true;

-- Create agent bot notification preferences table
CREATE TABLE IF NOT EXISTS public.agent_bot_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  
  -- Notification settings
  email_notifications_enabled boolean DEFAULT true,
  notification_frequency text DEFAULT 'daily' CHECK (notification_frequency IN ('instant', 'daily', 'weekly', 'never')),
  
  -- Which bots to notify about
  notify_for_bots text[] DEFAULT ARRAY['googlebot', 'claudebot', 'gptbot', 'perplexitybot']::text[],
  
  -- Last notification sent
  last_notification_sent_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(agent_id)
);

-- Create agent bot visit summary for efficient querying
CREATE TABLE IF NOT EXISTS public.agent_bot_visit_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  date date NOT NULL,
  
  -- Summary stats
  total_bot_visits integer DEFAULT 0,
  unique_bots text[] DEFAULT ARRAY[]::text[],
  visits_by_bot_type jsonb DEFAULT '{}'::jsonb,
  
  -- Page types visited
  profile_visits integer DEFAULT 0,
  artifact_visits integer DEFAULT 0,
  
  -- Cache performance
  cache_hits integer DEFAULT 0,
  cache_misses integer DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(agent_id, date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agent_bot_summary_agent_date ON public.agent_bot_visit_summary(agent_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_agent_bot_summary_date ON public.agent_bot_visit_summary(date DESC);

-- Create function to update agent bot summary
CREATE OR REPLACE FUNCTION update_agent_bot_summary()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process bot visits with agent_id
  IF NEW.is_bot = true AND NEW.agent_id IS NOT NULL THEN
    INSERT INTO public.agent_bot_visit_summary (
      agent_id,
      date,
      total_bot_visits,
      unique_bots,
      visits_by_bot_type,
      profile_visits,
      artifact_visits,
      cache_hits,
      cache_misses
    )
    VALUES (
      NEW.agent_id,
      DATE(NEW.timestamp),
      1,
      ARRAY[NEW.bot_type],
      jsonb_build_object(NEW.bot_type, 1),
      CASE WHEN NEW.path LIKE '%/agents/%' THEN 1 ELSE 0 END,
      CASE WHEN NEW.path LIKE '%/artifact/%' THEN 1 ELSE 0 END,
      CASE WHEN NEW.cache_status = 'HIT' THEN 1 ELSE 0 END,
      CASE WHEN NEW.cache_status = 'MISS' THEN 1 ELSE 0 END
    )
    ON CONFLICT (agent_id, date) DO UPDATE SET
      total_bot_visits = agent_bot_visit_summary.total_bot_visits + 1,
      unique_bots = array_append(
        agent_bot_visit_summary.unique_bots,
        NEW.bot_type
      ),
      visits_by_bot_type = agent_bot_visit_summary.visits_by_bot_type || 
        jsonb_build_object(
          NEW.bot_type,
          COALESCE((agent_bot_visit_summary.visits_by_bot_type->>NEW.bot_type)::int, 0) + 1
        ),
      profile_visits = agent_bot_visit_summary.profile_visits + 
        CASE WHEN NEW.path LIKE '%/agents/%' THEN 1 ELSE 0 END,
      artifact_visits = agent_bot_visit_summary.artifact_visits + 
        CASE WHEN NEW.path LIKE '%/artifact/%' THEN 1 ELSE 0 END,
      cache_hits = agent_bot_visit_summary.cache_hits + 
        CASE WHEN NEW.cache_status = 'HIT' THEN 1 ELSE 0 END,
      cache_misses = agent_bot_visit_summary.cache_misses + 
        CASE WHEN NEW.cache_status = 'MISS' THEN 1 ELSE 0 END,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update summary
CREATE TRIGGER trigger_update_agent_bot_summary
  AFTER INSERT ON public.cloudflare_request_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_bot_summary();

-- RLS policies
ALTER TABLE public.agent_bot_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_bot_visit_summary ENABLE ROW LEVEL SECURITY;

-- Agents can read/update their own notification preferences
CREATE POLICY "Agents can manage their notification preferences"
  ON public.agent_bot_notification_preferences
  FOR ALL
  USING (agent_id = auth.uid());

-- Agents can read their own bot visit summaries
CREATE POLICY "Agents can view their bot summaries"
  ON public.agent_bot_visit_summary
  FOR SELECT
  USING (agent_id = auth.uid());

-- Admin can see all
CREATE POLICY "Authenticated users can view all bot summaries"
  ON public.agent_bot_visit_summary
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role can do everything
CREATE POLICY "Service role can manage summaries"
  ON public.agent_bot_visit_summary
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage notification preferences"
  ON public.agent_bot_notification_preferences
  FOR ALL
  USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE public.agent_bot_notification_preferences IS 'Agent preferences for bot visit notifications';
COMMENT ON TABLE public.agent_bot_visit_summary IS 'Daily summary of bot visits per agent for efficient querying and notifications';
COMMENT ON COLUMN public.cloudflare_request_logs.agent_id IS 'Professional ID extracted from URL path if viewing agent profile or artifact';
