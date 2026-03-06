-- PART 1: Import agent ZIP activity data
-- This imports the 11,878 verified agent-ZIP mappings from Zillow transaction history
-- 
-- INSTRUCTIONS:
-- 1. Run the table creation SQL from lovable first
-- 2. Then run this script
-- 3. Replace the COPY command below with actual CSV import or use Supabase UI to upload agent_zip_activity.csv

-- Option A: If you have PostgreSQL COPY access
-- COPY agent_zip_activity (license_number, state, zip_code, transaction_count)
-- FROM '/path/to/agent_zip_activity.csv'
-- WITH (FORMAT csv, HEADER true);

-- Option B: Use Supabase UI
-- Go to Table Editor > agent_zip_activity > Insert > Import from CSV
-- Upload the agent_zip_activity.csv file

-- Option C: Use bulk INSERT (generated from CSV, truncated here for readability)
-- INSERT INTO agent_zip_activity (license_number, state, zip_code, transaction_count) VALUES
-- ('BR571396000', 'AZ', '85086', 5),
-- ('SA112295000', 'AZ', '85086', 5),
-- ... (11,878 rows total)
-- ;

-- ============================================================================
-- PART 2: Query Functions
-- ============================================================================

-- Function: Get active agents for a specific neighborhood
-- Returns agents with verified transactions in the neighborhood's ZIPs
CREATE OR REPLACE FUNCTION get_neighborhood_active_agents(p_neighborhood_id UUID)
RETURNS TABLE (
    license_number TEXT,
    state TEXT,
    agent_name TEXT,
    zillow_rating NUMERIC,
    zillow_reviews INTEGER,
    total_sales INTEGER,
    sales_last_12_months INTEGER,
    brokerage_name TEXT,
    phone TEXT,
    neighborhood_transactions INTEGER,
    zip_codes TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sl.license_number,
        sl.state,
        sl.name as agent_name,
        sl.zillow_rating,
        sl.zillow_reviews,
        sl.total_sales,
        sl.sales_last_12_months,
        sl.brokerage_name,
        sl.phone,
        SUM(aza.transaction_count)::INTEGER as neighborhood_transactions,
        array_agg(DISTINCT aza.zip_code ORDER BY aza.zip_code) as zip_codes
    FROM agent_zip_activity aza
    JOIN state_licenses sl 
        ON aza.license_number = sl.license_number 
        AND aza.state = sl.state
    WHERE aza.zip_code IN (
        SELECT zip_code 
        FROM neighborhood_zips 
        WHERE neighborhood_id = p_neighborhood_id
    )
    AND sl.zillow_rating >= 4.5
    AND sl.zillow_reviews >= 10
    GROUP BY 
        sl.license_number, 
        sl.state, 
        sl.name,
        sl.zillow_rating,
        sl.zillow_reviews,
        sl.total_sales,
        sl.sales_last_12_months,
        sl.brokerage_name,
        sl.phone
    HAVING SUM(aza.transaction_count) >= 1
    ORDER BY neighborhood_transactions DESC, sl.zillow_reviews DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_neighborhood_active_agents IS 'Returns qualified agents (4.5+/10+ in last 24 months) with verified transactions in a neighborhoods ZIP codes';

-- Function: Get agent count by neighborhood
CREATE OR REPLACE FUNCTION get_neighborhood_agent_counts()
RETURNS TABLE (
    neighborhood_id UUID,
    neighborhood_name TEXT,
    city_name TEXT,
    active_agent_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        nc.id as neighborhood_id,
        nc.name as neighborhood_name,
        c.name as city_name,
        COUNT(DISTINCT aza.license_number || aza.state) as active_agent_count
    FROM neighborhood_catalog nc
    JOIN cities c ON nc.city_id = c.id
    LEFT JOIN neighborhood_zips nz ON nc.id = nz.neighborhood_id
    LEFT JOIN agent_zip_activity aza ON nz.zip_code = aza.zip_code
    LEFT JOIN state_licenses sl 
        ON aza.license_number = sl.license_number 
        AND aza.state = sl.state
    WHERE sl.zillow_rating >= 4.5 
        AND sl.zillow_reviews >= 10
    GROUP BY nc.id, nc.name, c.name
    ORDER BY active_agent_count DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_neighborhood_agent_counts IS 'Returns count of qualified active agents per neighborhood based on verified transactions';

-- ============================================================================
-- PART 3: Example Queries
-- ============================================================================

-- Example 1: Get active agents for Arcadia
SELECT * FROM get_neighborhood_active_agents(
    (SELECT id FROM neighborhood_catalog WHERE slug = 'arcadia' LIMIT 1)
);

-- Example 2: Get all neighborhoods with agent counts
SELECT * FROM get_neighborhood_agent_counts()
WHERE active_agent_count > 0;

-- Example 3: Find neighborhoods with most active agents
SELECT 
    neighborhood_name,
    city_name,
    active_agent_count
FROM get_neighborhood_agent_counts()
WHERE active_agent_count >= 10
ORDER BY active_agent_count DESC
LIMIT 20;

-- Example 4: Get specific agent's active neighborhoods
SELECT 
    nc.name as neighborhood,
    c.name as city,
    SUM(aza.transaction_count) as transactions,
    array_agg(DISTINCT aza.zip_code) as zips
FROM agent_zip_activity aza
JOIN neighborhood_zips nz ON aza.zip_code = nz.zip_code
JOIN neighborhood_catalog nc ON nz.neighborhood_id = nc.id
JOIN cities c ON nc.city_id = c.id
WHERE aza.license_number = 'SA531657000'
    AND aza.state = 'AZ'
GROUP BY nc.name, c.name
ORDER BY transactions DESC;

-- Example 5: Get ZIP coverage statistics
SELECT 
    zip_code,
    COUNT(DISTINCT license_number || state) as agent_count,
    SUM(transaction_count) as total_transactions,
    ROUND(AVG(transaction_count)::numeric, 1) as avg_per_agent
FROM agent_zip_activity
WHERE state = 'AZ'
GROUP BY zip_code
HAVING COUNT(DISTINCT license_number || state) >= 10
ORDER BY agent_count DESC
LIMIT 20;

-- ============================================================================
-- PART 4: Statistics & Validation
-- ============================================================================

-- Verify import success
SELECT 
    COUNT(*) as total_mappings,
    COUNT(DISTINCT license_number || state) as unique_agents,
    COUNT(DISTINCT zip_code) as unique_zips,
    COUNT(DISTINCT state) as states_covered
FROM agent_zip_activity;

-- Check for unmapped ZIPs (ZIPs in activity but not in neighborhood_zips)
SELECT DISTINCT aza.zip_code
FROM agent_zip_activity aza
WHERE aza.state = 'AZ'
    AND NOT EXISTS (
        SELECT 1 FROM neighborhood_zips nz WHERE nz.zip_code = aza.zip_code
    )
ORDER BY aza.zip_code;

-- Show neighborhoods needing ZIP mappings
SELECT 
    c.name as city,
    nc.name as neighborhood,
    nc.slug
FROM neighborhood_catalog nc
JOIN cities c ON nc.city_id = c.id
WHERE nc.state = 'AZ'
    AND NOT EXISTS (
        SELECT 1 FROM neighborhood_zips nz WHERE nz.neighborhood_id = nc.id
    )
ORDER BY c.name, nc.name;
