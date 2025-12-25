-- Add unique constraint for upsert on agent_name, city, state
CREATE UNIQUE INDEX idx_zillow_search_unique_agent ON public.zillow_search_results (agent_name, city, state);