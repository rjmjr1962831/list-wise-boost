-- Add memo23 Zillow data fields to professionals table
ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS encoded_zuid text,
ADD COLUMN IF NOT EXISTS screen_name text,
ADD COLUMN IF NOT EXISTS in_canada boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS profile_type_ids jsonb,
ADD COLUMN IF NOT EXISTS profile_types jsonb,
ADD COLUMN IF NOT EXISTS sidebar_video_url text,
ADD COLUMN IF NOT EXISTS business_address jsonb,
ADD COLUMN IF NOT EXISTS business_name text,
ADD COLUMN IF NOT EXISTS cpd_user_pronouns text,
ADD COLUMN IF NOT EXISTS is_top_agent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS profile_image_id text,
ADD COLUMN IF NOT EXISTS is_premier_agent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ratings jsonb,
ADD COLUMN IF NOT EXISTS phone_numbers jsonb,
ADD COLUMN IF NOT EXISTS professional_data jsonb,
ADD COLUMN IF NOT EXISTS agent_licenses jsonb,
ADD COLUMN IF NOT EXISTS agent_sales_stats jsonb,
ADD COLUMN IF NOT EXISTS past_sales jsonb,
ADD COLUMN IF NOT EXISTS professional_information jsonb,
ADD COLUMN IF NOT EXISTS reviews_data jsonb,
ADD COLUMN IF NOT EXISTS team_display_information jsonb;

-- Add index on encoded_zuid for faster lookups
CREATE INDEX IF NOT EXISTS idx_professionals_encoded_zuid ON professionals(encoded_zuid);

-- Add comment explaining the memo23 data structure
COMMENT ON COLUMN professionals.agent_sales_stats IS 'Sales statistics from Zillow including countAllTime, countLastYear, price ranges, and stats_include_team flag';
COMMENT ON COLUMN professionals.past_sales IS 'Detailed past sales data including property details, dates, prices, and locations';
COMMENT ON COLUMN professionals.reviews_data IS 'Complete reviews data including individual reviews, subRatings, and reviewee information';