-- Update the enqueue trigger to only sync on agent-editable field changes
-- This prevents Pipedrive sync when review-required fields change (those come FROM Pipedrive)

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

  -- For UPDATE, only queue when AGENT-EDITABLE fields change
  -- These are fields where Supabase is source of truth
  -- Review-required fields (Pipedrive is source of truth) do NOT trigger sync
  IF TG_OP = 'UPDATE' THEN
    IF (
      -- Profile photo and video (agent-editable)
      OLD.image_url IS DISTINCT FROM NEW.image_url OR
      OLD.sidebar_video_url IS DISTINCT FROM NEW.sidebar_video_url OR
      
      -- Description and bio (agent writes their own description)
      OLD.description IS DISTINCT FROM NEW.description OR
      OLD.get_to_know_me IS DISTINCT FROM NEW.get_to_know_me OR
      
      -- Contact info (agents can update their own)
      OLD.phone IS DISTINCT FROM NEW.phone OR
      OLD.email IS DISTINCT FROM NEW.email OR
      OLD.website IS DISTINCT FROM NEW.website OR
      
      -- Company/brokerage (agent-editable)
      OLD.company IS DISTINCT FROM NEW.company OR
      OLD.business_name IS DISTINCT FROM NEW.business_name OR
      
      -- Specialties (agent-selected)
      OLD.specialty IS DISTINCT FROM NEW.specialty OR
      
      -- Achievements and press (agent-editable)
      OLD.notable_achievements IS DISTINCT FROM NEW.notable_achievements OR
      OLD.press_mentions IS DISTINCT FROM NEW.press_mentions OR
      
      -- Social links (agent-editable)
      OLD.social_facebook IS DISTINCT FROM NEW.social_facebook OR
      OLD.social_instagram IS DISTINCT FROM NEW.social_instagram OR
      OLD.social_linkedin IS DISTINCT FROM NEW.social_linkedin OR
      OLD.social_twitter IS DISTINCT FROM NEW.social_twitter OR
      OLD.social_tiktok IS DISTINCT FROM NEW.social_tiktok OR
      
      -- Profile link (for magic link updates)
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