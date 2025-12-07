-- Create composite index for the brand builder + qualified agent queries
-- This covers the most common query pattern: city_id + category_id + active + is_brand_builder + rating + reviews

CREATE INDEX IF NOT EXISTS idx_professionals_city_category_active_qualified 
ON public.professionals (city_id, category_id, active, is_brand_builder, review_stars_rating, num_total_reviews)
WHERE active = true;

-- Also index professional_cities for the join
CREATE INDEX IF NOT EXISTS idx_professional_cities_city_active 
ON public.professional_cities (city_id, active, professional_id)
WHERE active = true;