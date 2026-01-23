-- Insert La Jolla neighborhood from DeepSeek discovery results
INSERT INTO neighborhood_catalog (
  state,
  city_area,
  city_area_slug,
  neighborhood,
  neighborhood_slug,
  primary_zip,
  zips,
  tier,
  is_active,
  median_home_value,
  median_income,
  writeup_html
) VALUES (
  'California',
  'San Diego',
  'san-diego',
  'La Jolla',
  'la-jolla',
  '92037',
  ARRAY['92037', '92038'],
  'Luxury',
  true,
  2450000,
  175000,
  '<p>La Jolla is one of San Diego''s most prestigious coastal communities, known for its dramatic oceanfront cliffs, pristine beaches, and upscale village atmosphere. Home to the University of California San Diego and world-renowned research institutions like the Salk Institute and Scripps Institution of Oceanography, the neighborhood attracts academics, professionals, and families seeking a blend of natural beauty and intellectual vibrancy.</p><p>The La Jolla real estate market features Mediterranean-style estates, contemporary oceanfront properties, and luxury condominiums with panoramic Pacific views. The village core offers boutique shopping, fine dining, and art galleries along Prospect Street. La Jolla Cove, with its protected marine sanctuary, draws visitors year-round for snorkeling, kayaking, and seal watching.</p><p>Residents enjoy top-rated schools in the La Jolla cluster, including La Jolla High School and Torrey Pines High School. The community maintains a village character despite its proximity to downtown San Diego, with strong property values reflecting its status as one of California''s most desirable coastal addresses.</p>'
)
ON CONFLICT (state, city_area_slug, neighborhood_slug) DO NOTHING
RETURNING id, neighborhood_slug, primary_zip;