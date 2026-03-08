-- Merit Gate: 4.5+ stars, 10+ verified reviews (last 24 months), 5+ years in business.
-- Deprecates legacy 4.8+/20+ gates. See docs/cursor-daily-updates.md.

-- 1. Pipedrive enqueue trigger: use new gates (4.5+ rating, 10+ reviews)
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

  -- Skip if professional is not active
  IF NEW.active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Skip if professional does not meet North Star Merit Gate (4.5+ rating, 10+ reviews)
  IF NEW.review_stars_rating IS NULL OR NEW.review_stars_rating < 4.5 THEN
    RETURN NEW;
  END IF;

  IF NEW.num_total_reviews IS NULL OR NEW.num_total_reviews < 10 THEN
    RETURN NEW;
  END IF;

  -- Skip if professional is not enriched (must have synthesized bio)
  IF NEW.synthesized_bio IS NULL THEN
    RETURN NEW;
  END IF;

  -- For INSERT, always queue if qualified
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pipedrive_sync_queue
      WHERE professional_id = NEW.id
      AND status = 'completed'
      AND updated_at > now() - interval '24 hours'
    ) THEN
      INSERT INTO public.pipedrive_sync_queue (professional_id, status, attempts, next_retry_at)
      VALUES (NEW.id, 'pending', 0, now())
      ON CONFLICT (professional_id) DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;

  -- For UPDATE, queue when AGENT-EDITABLE fields change OR when funnel_status changes to approved
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
      (OLD.funnel_status IS DISTINCT FROM NEW.funnel_status AND NEW.funnel_status = 'approved')
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.pipedrive_sync_queue
        WHERE professional_id = NEW.id
        AND (status IN ('pending', 'processing') OR (status = 'completed' AND updated_at > now() - interval '1 hour'))
      ) THEN
        INSERT INTO public.pipedrive_sync_queue (professional_id, status, attempts, next_retry_at)
        VALUES (NEW.id, 'pending', 0, now())
        ON CONFLICT (professional_id) DO NOTHING;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.enqueue_professional_for_pipedrive_sync IS 'Enqueues professionals for Pipedrive sync when they meet North Star Merit Gate: 4.5+ stars, 10+ reviews. Legacy 4.8+/20+ deprecated Mar 2026.';

-- 2. Sitemap qualified neighborhoods: use new gates
CREATE OR REPLACE FUNCTION get_neighborhood_ids_with_qualified_agents()
RETURNS TABLE(id uuid) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT nc.id
  FROM neighborhood_catalog nc
  WHERE nc.is_active = true
    AND nc.primary_zip IS NOT NULL
    AND nc.state IN ('Arizona', 'California')
    AND nc.zips IS NOT NULL
    AND array_length(nc.zips, 1) > 0
    AND EXISTS (
      SELECT 1
      FROM agent_zip_activity aza
      JOIN professionals p ON aza.license_number = p.license_number
      WHERE aza.zip_code = ANY(nc.zips)
        AND p.active = true
        AND p.review_stars_rating >= 4.5
        AND p.num_total_reviews >= 10
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_neighborhood_ids_with_qualified_agents IS 'Returns neighborhood_catalog.id for neighborhoods with at least one 4.5+ star, 10+ review agent. Legacy 4.8+/20+ deprecated Mar 2026.';
