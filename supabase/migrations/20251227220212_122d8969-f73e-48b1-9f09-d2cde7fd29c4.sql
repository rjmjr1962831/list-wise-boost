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

  -- Skip if professional has no email (Pipedrive requires email)
  IF NEW.email IS NULL OR NEW.email = '' THEN
    RETURN NEW;
  END IF;

  -- Skip if professional is not qualified (4.8+ rating AND 20+ reviews)
  IF NEW.review_stars_rating IS NULL OR NEW.review_stars_rating < 4.8 THEN
    RETURN NEW;
  END IF;
  
  IF NEW.num_total_reviews IS NULL OR NEW.num_total_reviews < 20 THEN
    RETURN NEW;
  END IF;

  -- Skip if professional is not enriched (must have synthesized bio)
  IF NEW.synthesized_bio IS NULL THEN
    RETURN NEW;
  END IF;

  -- For INSERT, always queue if qualified
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.pipedrive_sync_queue (professional_id, status, attempts, next_retry_at)
    VALUES (NEW.id, 'pending', 0, now())
    ON CONFLICT (professional_id) 
    WHERE status = 'pending'
    DO UPDATE SET updated_at = now(), next_retry_at = now();
    RETURN NEW;
  END IF;

  -- For UPDATE, only queue when AGENT-EDITABLE fields change
  IF TG_OP = 'UPDATE' THEN
    IF (
      OLD.image_url IS DISTINCT FROM NEW.image_url OR
      OLD.sidebar_video_url IS DISTINCT FROM NEW.sidebar_video_url OR
      OLD.description IS DISTINCT FROM NEW.description OR
      OLD.get_to_know_me IS DISTINCT FROM NEW.get_to_know_me OR
      OLD.phone IS DISTINCT FROM NEW.phone OR
      OLD.email IS DISTINCT FROM NEW.email OR
      OLD.website IS DISTINCT FROM NEW.website OR
      OLD.company IS DISTINCT FROM NEW.company OR
      OLD.business_name IS DISTINCT FROM NEW.business_name OR
      OLD.specialty IS DISTINCT FROM NEW.specialty OR
      OLD.notable_achievements IS DISTINCT FROM NEW.notable_achievements OR
      OLD.press_mentions IS DISTINCT FROM NEW.press_mentions OR
      OLD.social_facebook IS DISTINCT FROM NEW.social_facebook OR
      OLD.social_instagram IS DISTINCT FROM NEW.social_instagram OR
      OLD.social_linkedin IS DISTINCT FROM NEW.social_linkedin OR
      OLD.social_twitter IS DISTINCT FROM NEW.social_twitter OR
      OLD.social_tiktok IS DISTINCT FROM NEW.social_tiktok OR
      OLD.profile_link IS DISTINCT FROM NEW.profile_link OR
      OLD.short_code IS DISTINCT FROM NEW.short_code
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