-- Arcadia, Phoenix: Add comprehensive writeup and market stats (Main Street Arts District format)
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/wiotrvoirdgzfacuuiem/sql/new

-- 1. Update neighborhood_catalog with writeup_html for Arcadia
UPDATE neighborhood_catalog
SET writeup_html = '
<h2>Neighborhood Overview</h2>
<p>Arcadia is one of Phoenix''s most coveted neighborhoods, prized for its mature tree canopy, mid-century homes, and prime central location. Bounded roughly by 44th Street to the west, the Arizona Canal to the north, 64th Street to the east, and Camelback Road to the south, Arcadia sits at the heart of the Valley with convenient access to Scottsdale, downtown Phoenix, and Sky Harbor Airport. The neighborhood evolved from citrus groves in the mid-20th century into a residential haven where shade trees line the streets and lot sizes are generous by modern standards.</p>

<h2>Lifestyle & Community</h2>
<p>Living in Arcadia means embracing an outdoor-oriented, community-focused lifestyle where neighbors know each other and local businesses thrive. Residents enjoy walking or cycling along the Arizona Canal, dining at neighborhood favorites along 44th Street and Camelback, and participating in community events at Ingleside Middle School or the nearby Phoenix Country Day School. The area attracts professionals, families, and retirees who value the combination of urban proximity and residential tranquility.</p>

<h2>Real Estate Market</h2>
<p>Arcadia commands premium positioning in Phoenix''s competitive real estate market, with a median home value of $748,600 reflecting its desirability and limited inventory. The housing stock ranges from mid-century ranch homes on large lots to custom builds and renovated estates. Many homes feature original terrazzo floors, expansive windows, and mature landscaping. The median household income of $85,335 supports strong market stability and attracts buyers seeking both investment potential and lifestyle quality.</p>

<h2>Amenities & Attractions</h2>
<p>Residents enjoy exceptional access to dining, shopping, and recreation. Key amenities include:</p>
<ul>
<li>Arcadia Farms Cafe and La Grande Orange at the heart of the dining scene</li>
<li>Biltmore Fashion Park and adjacent luxury retail</li>
<li>Arizona Canal multi-use path for walking, running, and cycling</li>
<li>Camelback Mountain trailheads within minutes</li>
<li>Phoenix Country Day School and top-rated public schools in the area</li>
<li>Quick access to Scottsdale, downtown Phoenix, and Sky Harbor</li>
</ul>

<h2>Why Choose Arcadia</h2>
<p>Arcadia offers a rare combination of established character and central convenience that''s difficult to find elsewhere in the Phoenix metro. The mature tree canopy provides shade and aesthetic appeal that newer subdivisions cannot replicate. With strong schools, walkable commercial corridors, and proximity to Camelback Mountain and the Biltmore area, Arcadia appeals to buyers who want the best of Phoenix living. For those seeking a home where community, character, and location converge, Arcadia represents Phoenix at its finest.</p>
',
  updated_at = now()
WHERE neighborhood_slug = 'arcadia'
  AND city_area_slug = 'phoenix'
  AND is_active = true;

-- 2. Upsert market_stats for useNeighborhoodMarketStats (page: neighborhood-arizona-arcadia)
INSERT INTO marketing_content (page, section, key, value, type, created_at, updated_at)
VALUES (
  'neighborhood-arizona-arcadia',
  'market_stats',
  'full_content',
  '{"medianHomePrice":748600,"medianHouseholdIncome":85335,"medianRent":2100,"daysOnMarket":45,"pricePerSqFt":385,"yearOverYearChange":0.041,"inventoryLevel":"Low","marketType":"Seller''s Market","averageHomeSize":1950,"homeownershipRate":0.72,"rentToIncomeRatio":0.29,"rentalVacancyRate":0.05,"pctRenterOccupied":0.28,"metadata":{"generatedAt":"2026-02-20T00:00:00Z","neighborhoodName":"Arcadia","cityArea":"Phoenix","state":"Arizona","stateAbbrev":"AZ","primaryZip":"85018","version":"1.0"}}',
  'text',
  now(),
  now()
)
ON CONFLICT (page, section, key)
DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();
