-- Update qualification criteria from 4.8+/20+ to 4.5+/10+ (Merit Gate)
-- Canonical gate: 4.5+ stars, 10+ verified reviews in last 24 months, 5+ years in business

-- Pipedrive sync trigger
CREATE OR REPLACE FUNCTION public.enqueue_professional_for_pipedrive_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.skip_pipedrive_sync = TRUE THEN
    NEW.skip_pipedrive_sync = FALSE;
    RETURN NEW;
  END IF;

  IF NEW.email IS NULL OR NEW.email = '' THEN
    RETURN NEW;
  END IF;

  -- Merit Gate: 4.5+ rating AND 10+ reviews
  IF NEW.review_stars_rating IS NULL OR NEW.review_stars_rating < 4.5 THEN
    RETURN NEW;
  END IF;
  
  IF NEW.num_total_reviews IS NULL OR NEW.num_total_reviews < 10 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.pipedrive_sync_queue (professional_id, status, attempts, next_retry_at)
    VALUES (NEW.id, 'pending', 0, now())
    ON CONFLICT (professional_id) 
    WHERE status = 'pending'
    DO UPDATE SET updated_at = now(), next_retry_at = now();
    RETURN NEW;
  END IF;

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

-- get_neighborhood_ids_with_qualified_agents (sitemap Rule A)
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

COMMENT ON FUNCTION get_neighborhood_ids_with_qualified_agents IS 'Returns neighborhood_catalog.id for neighborhoods with at least one 4.5+ star, 10+ review agent (Merit Gate, for sitemap Rule A filter)';

-- get_neighborhood_active_agents
CREATE OR REPLACE FUNCTION get_neighborhood_active_agents(p_neighborhood_id UUID)
RETURNS TABLE (
    professional_id UUID,
    license_number TEXT,
    state TEXT,
    agent_name TEXT,
    company TEXT,
    image_url TEXT,
    review_stars_rating NUMERIC,
    num_total_reviews INTEGER,
    years_experience INTEGER,
    phone TEXT,
    email TEXT,
    website TEXT,
    synthesized_bio TEXT,
    specialty TEXT[],
    canonical_slug TEXT,
    license_verified_at TIMESTAMPTZ,
    neighborhood_transactions INTEGER,
    transaction_zips TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as professional_id,
        aza.license_number,
        aza.state,
        p.name as agent_name,
        p.company,
        p.image_url,
        p.review_stars_rating,
        p.num_total_reviews::INTEGER,
        p.years_experience::INTEGER,
        p.phone,
        p.email,
        p.website,
        p.synthesized_bio,
        p.specialty,
        p.canonical_slug,
        p.license_verified_at,
        SUM(aza.transaction_count)::INTEGER as neighborhood_transactions,
        array_agg(DISTINCT aza.zip_code ORDER BY aza.zip_code) as transaction_zips
    FROM agent_zip_activity aza
    JOIN professionals p 
        ON aza.license_number = p.license_number
    WHERE aza.zip_code = ANY(
        SELECT unnest(zips) 
        FROM neighborhood_catalog 
        WHERE id = p_neighborhood_id
    )
    AND p.active = true
    AND p.review_stars_rating >= 4.5
    AND p.num_total_reviews >= 10
    GROUP BY 
        p.id,
        aza.license_number, 
        aza.state, 
        p.name,
        p.company,
        p.image_url,
        p.review_stars_rating,
        p.num_total_reviews,
        p.years_experience,
        p.phone,
        p.email,
        p.website,
        p.synthesized_bio,
        p.specialty,
        p.canonical_slug,
        p.license_verified_at
    HAVING SUM(aza.transaction_count) >= 1
    ORDER BY neighborhood_transactions DESC, p.num_total_reviews DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_neighborhood_active_agents IS 'Returns qualified agents with verified transactions in neighborhood ZIPs (Merit Gate: 4.5+, 10+)';
