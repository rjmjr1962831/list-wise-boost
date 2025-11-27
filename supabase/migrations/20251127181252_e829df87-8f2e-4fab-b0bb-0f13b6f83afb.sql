-- Fix security issues: Set search_path for functions
CREATE OR REPLACE FUNCTION check_recent_reviews(reviews_data jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        review_date := (zillow_review->>'createDate')::timestamptz;
        IF review_date >= one_year_ago THEN
          RETURN true;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        CONTINUE;
      END;
    END LOOP;
  END IF;
  
  -- Check external_reviews
  IF reviews_data->'external_reviews' IS NOT NULL THEN
    FOR external_review IN SELECT * FROM jsonb_array_elements(reviews_data->'external_reviews')
    LOOP
      BEGIN
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
$$;

CREATE OR REPLACE FUNCTION update_has_recent_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.has_recent_review := check_recent_reviews(NEW.reviews_data);
  RETURN NEW;
END;
$$;