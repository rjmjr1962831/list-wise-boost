-- Add redfin_url column to agent_applications table
ALTER TABLE agent_applications
ADD COLUMN IF NOT EXISTS redfin_url TEXT;