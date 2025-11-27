-- Add columns to track review recency
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS has_recent_review boolean DEFAULT false;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS most_recent_review_date timestamptz;

-- Create function to check for reviews within the last year
CREATE OR REPLACE FUNCTION check_recent_reviews(reviews_data jsonb)
RETURNS boolean AS $$
DECLARE
  one_year_ago timestamptz := NOW() - INTERVAL '1 year';
  zillow_review jsonb;
  external_review jsonb;
  review_date timestamptz;
BEGIN
  -- Check zillow_reviews
  IF reviews_data->'zillow_reviews' IS NOT NULL THEN
    FOR zillow_review IN SELECT * FROM jsonb_array_elements(reviews_data->'zillow_reviews')
    LOOP
      BEGIN
        -- Zillow uses ISO format: 2024-07-28T11:59:00
        review_date := (zillow_review->>'createDate')::timestamptz;
        IF review_date >= one_year_ago THEN
          RETURN true;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        CONTINUE;
      END;
    END LOOP;
  END IF;
  
  -- Check external_reviews (Google/Yelp)
  IF reviews_data->'external_reviews' IS NOT NULL THEN
    FOR external_review IN SELECT * FROM jsonb_array_elements(reviews_data->'external_reviews')
    LOOP
      BEGIN
        -- External reviews use MM/DD/YYYY HH24:MI:SS format
        review_date := to_timestamp(external_review->>'reviewDate', 'MM/DD/YYYY HH24:MI:SS');
        IF review_date >= one_year_ago THEN
          RETURN true;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        CONTINUE;
      END;
    END LOOP;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to automatically update has_recent_review
CREATE OR REPLACE FUNCTION update_has_recent_review()
RETURNS TRIGGER AS $$
BEGIN
  NEW.has_recent_review := check_recent_reviews(NEW.reviews_data);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_has_recent_review ON professionals;
CREATE TRIGGER trigger_update_has_recent_review
  BEFORE INSERT OR UPDATE OF reviews_data ON professionals
  FOR EACH ROW
  EXECUTE FUNCTION update_has_recent_review();

-- Backfill existing data
UPDATE professionals 
SET has_recent_review = check_recent_reviews(reviews_data)
WHERE reviews_data IS NOT NULL;