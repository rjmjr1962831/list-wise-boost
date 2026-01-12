-- Part 1: Create agent_zip_activity table for verified transactions
CREATE TABLE IF NOT EXISTS agent_zip_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_number TEXT NOT NULL,
    state TEXT NOT NULL,
    zip_code TEXT NOT NULL,
    transaction_count INTEGER NOT NULL DEFAULT 1,
    last_verified_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_agent_zip 
        UNIQUE (license_number, state, zip_code)
);

-- Enable RLS
ALTER TABLE agent_zip_activity ENABLE ROW LEVEL SECURITY;

-- Public read policy (agent activity is public data)
CREATE POLICY "Agent ZIP activity is publicly readable"
    ON agent_zip_activity
    FOR SELECT
    USING (true);

-- Service role can manage
CREATE POLICY "Service role can manage agent ZIP activity"
    ON agent_zip_activity
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_agent_zip_zip ON agent_zip_activity(zip_code);
CREATE INDEX IF NOT EXISTS idx_agent_zip_license ON agent_zip_activity(license_number, state);
CREATE INDEX IF NOT EXISTS idx_agent_zip_count ON agent_zip_activity(transaction_count DESC);
CREATE INDEX IF NOT EXISTS idx_agent_zip_lookup ON agent_zip_activity(zip_code, transaction_count DESC);

COMMENT ON TABLE agent_zip_activity IS 'Verified agent transaction activity by ZIP code - based on actual Zillow past sales data, not office location radius';

-- Part 2: Create database function to get neighborhood agents by transactions
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
    AND p.review_stars_rating >= 4.8
    AND p.num_total_reviews >= 20
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

COMMENT ON FUNCTION get_neighborhood_active_agents IS 'Returns qualified agents with verified transactions in neighborhood ZIPs using neighborhood_catalog.zips array';