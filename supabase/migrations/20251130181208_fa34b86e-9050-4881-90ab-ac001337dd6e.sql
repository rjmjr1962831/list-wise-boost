-- Add profile_link column to professionals table
ALTER TABLE professionals 
ADD COLUMN IF NOT EXISTS profile_link TEXT;

-- Add index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_professionals_verification_token 
ON professionals(verification_token) 
WHERE verification_token IS NOT NULL;

COMMENT ON COLUMN professionals.profile_link IS 'Full URL to magic link profile page: https://top10lists.us/profile/{token}';