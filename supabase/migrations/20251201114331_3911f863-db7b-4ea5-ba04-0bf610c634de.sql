-- Create trigger to auto-queue cache invalidation when professionals are updated
-- This ensures canonical rankings stay fresh when agent data changes

CREATE OR REPLACE FUNCTION auto_queue_cache_invalidation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only queue if significant fields changed (ratings, sales, reviews, etc.)
  IF (
    (OLD.review_stars_rating IS DISTINCT FROM NEW.review_stars_rating) OR
    (OLD.num_total_reviews IS DISTINCT FROM NEW.num_total_reviews) OR
    (OLD.total_sales IS DISTINCT FROM NEW.total_sales) OR
    (OLD.years_experience IS DISTINCT FROM NEW.years_experience) OR
    (OLD.has_recent_review IS DISTINCT FROM NEW.has_recent_review) OR
    (OLD.press_mentions IS DISTINCT FROM NEW.press_mentions) OR
    (OLD.is_brand_builder IS DISTINCT FROM NEW.is_brand_builder) OR
    (OLD.is_premier_agent IS DISTINCT FROM NEW.is_premier_agent) OR
    (OLD.is_top_agent IS DISTINCT FROM NEW.is_top_agent) OR
    (OLD.active IS DISTINCT FROM NEW.active)
  ) THEN
    -- Queue cache invalidation (use ON CONFLICT to avoid duplicates)
    INSERT INTO public.cache_invalidation_queue (
      city_id,
      category_id,
      reason,
      status
    ) VALUES (
      NEW.city_id,
      NEW.category_id,
      'Professional updated: ' || NEW.name,
      'pending'
    )
    ON CONFLICT (city_id, category_id) 
    WHERE status = 'pending'
    DO NOTHING; -- Don't duplicate if already pending for this city/category
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on professionals table
DROP TRIGGER IF EXISTS trigger_auto_queue_cache_invalidation ON public.professionals;

CREATE TRIGGER trigger_auto_queue_cache_invalidation
  AFTER UPDATE ON public.professionals
  FOR EACH ROW
  EXECUTE FUNCTION auto_queue_cache_invalidation();

-- Add unique constraint to prevent duplicate pending items for same city/category
CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_queue_unique_pending 
  ON public.cache_invalidation_queue(city_id, category_id) 
  WHERE status = 'pending';