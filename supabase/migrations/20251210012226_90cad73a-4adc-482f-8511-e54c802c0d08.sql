-- Step 2: Create professionals_public view excluding sensitive internal fields
-- This view keeps contact info (email, phone, website) PUBLIC as intended for agent directory
-- Only internal/administrative fields are excluded

CREATE OR REPLACE VIEW public.professionals_public AS
SELECT 
    -- Core identity (PUBLIC)
    id,
    name,
    title,
    headline,
    type,
    
    -- Contact info (INTENTIONALLY PUBLIC for agent directory)
    email,
    phone,
    website,
    address,
    zip_code,
    
    -- Media (PUBLIC)
    image_url,
    og_image_url,
    sidebar_video_url,
    profile_link,
    review_link,
    zillow_profile_url,
    
    -- Professional info (PUBLIC)
    company,
    business_name,
    business_address,
    description,
    synthesized_bio,
    get_to_know_me,
    selection_rationale,
    specialty,
    badges,
    certifications,
    certifications_verified,
    awards_verified,
    notable_achievements,
    press_mentions,
    publications,
    community_roles,
    languages,
    service_areas,
    
    -- License info (PUBLIC - this is public record)
    license_number,
    license_type,
    license_status,
    license_issued_at,
    license_expires_at,
    
    -- Reviews/Ratings (PUBLIC)
    review_stars_rating,
    num_total_reviews,
    ratings,
    platform_reviews,
    reviews_data,
    reviews_text,
    has_recent_review,
    most_recent_review_date,
    
    -- Stats (PUBLIC)
    years_experience,
    total_sales,
    current_listings,
    agent_sales_stats,
    past_sales,
    
    -- Rank info (PUBLIC)
    rank,
    is_top_agent,
    is_premier_agent,
    is_brand_builder,
    
    -- Category/City references (PUBLIC)
    city_id,
    category_id,
    active,
    
    -- Team info (PUBLIC)
    team_display_information,
    cpd_user_pronouns,
    
    -- Social links (PUBLIC)
    social_facebook,
    social_instagram,
    social_linkedin,
    
    -- Professional data (PUBLIC)
    professional_data,
    professional_information,
    agent_licenses,
    profile_types,
    profile_type_ids,
    
    -- Timestamps (PUBLIC - for freshness signals)
    created_at,
    updated_at,
    card_created_at,
    zillow_data_fetched_at
    
    -- EXCLUDED (internal/sensitive):
    -- verification_token, verification_token_expires_at, verification_started_at
    -- claimed_by, claimed_at, claim_status, claim_notes
    -- raw_scraper_data, data_sources_log
    -- skip_pipedrive_sync
    -- encoded_zuid, zuid, screen_name, profile_image_id
    -- profile_last_synthesized_at, selection_rationale_generated_at
    -- zillow_search_page, zillow_search_position, zillow_search_total, zillow_search_city, zillow_rank_captured_at
    -- funnel_completed_at, funnel_status
    -- email_verified_at, license_verified_at
    -- in_canada
    
FROM public.professionals
WHERE active = true;

-- Add comment explaining the view
COMMENT ON VIEW public.professionals_public IS 'Public-facing view of professionals table. Excludes internal fields like verification tokens, claim notes, raw scraper data, and internal timestamps. Contact info (email, phone, website) is intentionally public for the agent directory.';