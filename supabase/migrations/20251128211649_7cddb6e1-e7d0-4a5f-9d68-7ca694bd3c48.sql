-- Add press_mentions field to store news and awards
ALTER TABLE public.professionals 
ADD COLUMN IF NOT EXISTS press_mentions JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.professionals.press_mentions IS 'Array of press mentions and awards: [{title, source, date, url, type: "press"|"award"}]';