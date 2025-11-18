-- Extend agent_applications table with new fields for the funnel
ALTER TABLE agent_applications
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS ai_generated_bio text,
ADD COLUMN IF NOT EXISTS selected_specialties text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS monthly_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS profile_accepted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS current_step integer DEFAULT 1;

-- Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_agent_applications_user_id ON agent_applications(user_id);

-- Update RLS policies to allow users to manage their own applications
CREATE POLICY "Users can view their own applications"
ON agent_applications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own applications"
ON agent_applications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own applications"
ON agent_applications FOR INSERT
WITH CHECK (auth.uid() = user_id);