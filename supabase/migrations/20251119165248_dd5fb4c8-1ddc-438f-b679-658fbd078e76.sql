-- Add review fields to professionals table
ALTER TABLE professionals 
ADD COLUMN IF NOT EXISTS review_link text,
ADD COLUMN IF NOT EXISTS num_total_reviews integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS reviews_text text,
ADD COLUMN IF NOT EXISTS review_stars_rating numeric(3,2) CHECK (review_stars_rating >= 0 AND review_stars_rating <= 5);