-- Update the trigger function to sync on ALL field changes
CREATE OR REPLACE FUNCTION public.enqueue_professional_for_pipedrive_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip if sync flag is set (prevents infinite loops from webhook updates)
  IF NEW.skip_pipedrive_sync = TRUE THEN
    NEW.skip_pipedrive_sync = FALSE;
    RETURN NEW;
  END IF;

  -- For INSERT, always queue
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.pipedrive_sync_queue (professional_id, status, attempts, next_retry_at)
    VALUES (NEW.id, 'pending', 0, now())
    ON CONFLICT (professional_id) 
    WHERE status = 'pending'
    DO UPDATE SET updated_at = now(), next_retry_at = now();
    RETURN NEW;
  END IF;

  -- For UPDATE, queue on ANY significant field change
  IF TG_OP = 'UPDATE' THEN
    -- Check if any syncable fields changed
    IF (
      -- Core identity
      OLD.name IS DISTINCT FROM NEW.name OR
      OLD.email IS DISTINCT FROM NEW.email OR
      OLD.phone IS DISTINCT FROM NEW.phone OR
      OLD.company IS DISTINCT FROM NEW.company OR
      OLD.business_name IS DISTINCT FROM NEW.business_name OR
      OLD.title IS DISTINCT FROM NEW.title OR
      OLD.headline IS DISTINCT FROM NEW.headline OR
      -- Bio/description
      OLD.description IS DISTINCT FROM NEW.description OR
      OLD.synthesized_bio IS DISTINCT FROM NEW.synthesized_bio OR
      OLD.get_to_know_me IS DISTINCT FROM NEW.get_to_know_me OR
      -- Media
      OLD.image_url IS DISTINCT FROM NEW.image_url OR
      OLD.sidebar_video_url IS DISTINCT FROM NEW.sidebar_video_url OR
      OLD.website IS DISTINCT FROM NEW.website OR
      -- Social
      OLD.social_facebook IS DISTINCT FROM NEW.social_facebook OR
      OLD.social_instagram IS DISTINCT FROM NEW.social_instagram OR
      OLD.social_linkedin IS DISTINCT FROM NEW.social_linkedin OR
      -- Professional data
      OLD.license_number IS DISTINCT FROM NEW.license_number OR
      OLD.license_type IS DISTINCT FROM NEW.license_type OR
      OLD.license_status IS DISTINCT FROM NEW.license_status OR
      OLD.years_experience IS DISTINCT FROM NEW.years_experience OR
      OLD.total_sales IS DISTINCT FROM NEW.total_sales OR
      OLD.current_listings IS DISTINCT FROM NEW.current_listings OR
      -- Reviews/ratings
      OLD.review_stars_rating IS DISTINCT FROM NEW.review_stars_rating OR
      OLD.num_total_reviews IS DISTINCT FROM NEW.num_total_reviews OR
      -- Arrays/JSON
      OLD.specialty IS DISTINCT FROM NEW.specialty OR
      OLD.notable_achievements IS DISTINCT FROM NEW.notable_achievements OR
      OLD.press_mentions IS DISTINCT FROM NEW.press_mentions OR
      OLD.certifications IS DISTINCT FROM NEW.certifications OR
      OLD.languages IS DISTINCT FROM NEW.languages OR
      OLD.service_areas IS DISTINCT FROM NEW.service_areas OR
      -- Status fields
      OLD.claim_status IS DISTINCT FROM NEW.claim_status OR
      OLD.active IS DISTINCT FROM NEW.active OR
      OLD.funnel_status IS DISTINCT FROM NEW.funnel_status OR
      OLD.is_top_agent IS DISTINCT FROM NEW.is_top_agent OR
      OLD.is_premier_agent IS DISTINCT FROM NEW.is_premier_agent OR
      OLD.is_brand_builder IS DISTINCT FROM NEW.is_brand_builder OR
      -- Links
      OLD.profile_link IS DISTINCT FROM NEW.profile_link OR
      OLD.zillow_profile_url IS DISTINCT FROM NEW.zillow_profile_url OR
      OLD.review_link IS DISTINCT FROM NEW.review_link
    ) THEN
      INSERT INTO public.pipedrive_sync_queue (professional_id, status, attempts, next_retry_at)
      VALUES (NEW.id, 'pending', 0, now())
      ON CONFLICT (professional_id) 
      WHERE status = 'pending'
      DO UPDATE SET updated_at = now(), next_retry_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;