-- Add synthesis columns to professionals table
ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS notable_achievements jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS publications jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS community_roles jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS synthesized_bio text,
ADD COLUMN IF NOT EXISTS profile_last_synthesized_at timestamp with time zone;

-- Add index for faster querying of synthesized profiles
CREATE INDEX IF NOT EXISTS idx_professionals_synthesized 
ON professionals(profile_last_synthesized_at) 
WHERE profile_last_synthesized_at IS NOT NULL;

-- Add comment to document the structure
COMMENT ON COLUMN professionals.notable_achievements IS 'Array of {title: string, description: string, year: number, credibility: number, source: string}';
COMMENT ON COLUMN professionals.publications IS 'Array of {title: string, type: string, publisher: string, year: number, url: string}';
COMMENT ON COLUMN professionals.community_roles IS 'Array of {organization: string, role: string, description: string}';