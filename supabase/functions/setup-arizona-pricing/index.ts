import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CityData {
  city_name: string;
  city_slug: string;
  value_tier: number;
  tier_name: string;
  price_monthly: number;
  price_annual: number;
  zip_codes: string[];
  description: string;
  display_order: number;
}

const ARIZONA_CITIES: CityData[] = [
  { city_name: 'Scottsdale', city_slug: 'scottsdale', value_tier: 5, tier_name: 'Platinum', price_monthly: 499, price_annual: 4990, zip_codes: ['85250', '85251', '85252', '85253', '85254', '85255', '85256', '85257', '85258', '85259', '85260', '85261', '85262', '85266', '85267', '85271'], description: 'Luxury market, high-net-worth buyers', display_order: 1 },
  { city_name: 'Paradise Valley', city_slug: 'paradise-valley', value_tier: 5, tier_name: 'Platinum', price_monthly: 499, price_annual: 4990, zip_codes: ['85253'], description: 'Ultra-luxury enclave, exclusive properties', display_order: 2 },
  { city_name: 'Fountain Hills', city_slug: 'fountain-hills', value_tier: 5, tier_name: 'Platinum', price_monthly: 499, price_annual: 4990, zip_codes: ['85268', '85269'], description: 'Upscale community, scenic desert living', display_order: 3 },
  { city_name: 'Cave Creek', city_slug: 'cave-creek', value_tier: 5, tier_name: 'Platinum', price_monthly: 499, price_annual: 4990, zip_codes: ['85327', '85331'], description: 'Western luxury, custom homes', display_order: 4 },
  { city_name: 'Carefree', city_slug: 'carefree', value_tier: 5, tier_name: 'Platinum', price_monthly: 499, price_annual: 4990, zip_codes: ['85377'], description: 'Exclusive resort community', display_order: 5 },
  { city_name: 'Chandler', city_slug: 'chandler', value_tier: 5, tier_name: 'Platinum', price_monthly: 499, price_annual: 4990, zip_codes: ['85224', '85225', '85226', '85246', '85248', '85249', '85286'], description: 'Tech corridor, high-end developments', display_order: 6 },
  { city_name: 'Gilbert', city_slug: 'gilbert', value_tier: 5, tier_name: 'Platinum', price_monthly: 499, price_annual: 4990, zip_codes: ['85233', '85234', '85295', '85296', '85297', '85298', '85299'], description: 'Top-rated schools, family market', display_order: 7 },
  { city_name: 'Phoenix', city_slug: 'phoenix', value_tier: 5, tier_name: 'Platinum', price_monthly: 499, price_annual: 4990, zip_codes: ['85001', '85002', '85003', '85004', '85006', '85007', '85008', '85009', '85012', '85013', '85014', '85015', '85016', '85017', '85018', '85019', '85020', '85021', '85022', '85023', '85024', '85027', '85028', '85029', '85031', '85032', '85033', '85034', '85035', '85037', '85040', '85041', '85042', '85043', '85044', '85045', '85048', '85050', '85051', '85053', '85054'], description: 'Major metro, diverse neighborhoods', display_order: 8 },
  { city_name: 'Mesa', city_slug: 'mesa', value_tier: 5, tier_name: 'Platinum', price_monthly: 499, price_annual: 4990, zip_codes: ['85201', '85202', '85203', '85204', '85205', '85206', '85207', '85208', '85209', '85210', '85211', '85212', '85213', '85214', '85215', '85216'], description: 'Large suburban market, steady growth', display_order: 9 },
  { city_name: 'Tempe', city_slug: 'tempe', value_tier: 5, tier_name: 'Platinum', price_monthly: 499, price_annual: 4990, zip_codes: ['85281', '85282', '85283', '85284', '85285', '85287'], description: 'ASU area, young professionals', display_order: 10 },
  { city_name: 'Peoria', city_slug: 'peoria', value_tier: 5, tier_name: 'Platinum', price_monthly: 499, price_annual: 4990, zip_codes: ['85345', '85380', '85381', '85382', '85383'], description: 'Growing northwest valley', display_order: 11 },
  { city_name: 'Glendale', city_slug: 'glendale', value_tier: 4, tier_name: 'Gold', price_monthly: 249, price_annual: 2490, zip_codes: ['85301', '85302', '85303', '85304', '85305', '85306', '85307', '85308', '85310', '85311', '85312', '85318'], description: 'Sports district, established neighborhoods', display_order: 12 },
  { city_name: 'Surprise', city_slug: 'surprise', value_tier: 4, tier_name: 'Gold', price_monthly: 249, price_annual: 2490, zip_codes: ['85374', '85378', '85379', '85387', '85388'], description: 'Fast-growing retirement and family area', display_order: 13 },
  { city_name: 'Goodyear', city_slug: 'goodyear', value_tier: 4, tier_name: 'Gold', price_monthly: 249, price_annual: 2490, zip_codes: ['85338', '85395'], description: 'Master-planned communities', display_order: 14 },
  { city_name: 'Queen Creek', city_slug: 'queen-creek', value_tier: 4, tier_name: 'Gold', price_monthly: 249, price_annual: 2490, zip_codes: ['85140', '85142'], description: 'Rural luxury, equestrian properties', display_order: 15 },
  { city_name: 'Sedona', city_slug: 'sedona', value_tier: 4, tier_name: 'Gold', price_monthly: 249, price_annual: 2490, zip_codes: ['86336', '86339', '86340', '86341'], description: 'Tourist destination, vacation homes', display_order: 16 },
  { city_name: 'Tucson', city_slug: 'tucson', value_tier: 3, tier_name: 'Silver', price_monthly: 99, price_annual: 990, zip_codes: ['85701', '85702', '85703', '85704', '85705', '85706', '85707', '85708', '85709', '85710', '85711', '85712', '85713', '85714', '85715', '85716', '85717', '85718', '85719', '85720', '85721', '85722', '85723', '85724', '85725', '85726', '85728', '85730', '85731', '85732', '85733', '85734', '85735', '85736', '85737', '85739', '85740', '85741', '85742', '85743', '85744', '85745', '85746', '85747', '85748', '85749', '85750', '85751', '85752', '85754', '85755', '85756', '85757'], description: 'Second largest AZ metro, university town', display_order: 17 },
  { city_name: 'Buckeye', city_slug: 'buckeye', value_tier: 3, tier_name: 'Silver', price_monthly: 99, price_annual: 990, zip_codes: ['85326', '85396'], description: 'Fastest growing city in US', display_order: 18 },
  { city_name: 'Avondale', city_slug: 'avondale', value_tier: 3, tier_name: 'Silver', price_monthly: 99, price_annual: 990, zip_codes: ['85323', '85392'], description: 'West valley growth corridor', display_order: 19 },
  { city_name: 'Flagstaff', city_slug: 'flagstaff', value_tier: 3, tier_name: 'Silver', price_monthly: 99, price_annual: 990, zip_codes: ['86001', '86002', '86003', '86004', '86011'], description: 'Mountain community, NAU area', display_order: 20 },
  { city_name: 'Prescott', city_slug: 'prescott', value_tier: 3, tier_name: 'Silver', price_monthly: 99, price_annual: 990, zip_codes: ['86301', '86302', '86303', '86304', '86305'], description: 'Retirement destination, historic downtown', display_order: 21 },
  { city_name: 'Lake Havasu City', city_slug: 'lake-havasu-city', value_tier: 3, tier_name: 'Silver', price_monthly: 99, price_annual: 990, zip_codes: ['86403', '86404', '86405', '86406'], description: 'Recreation destination, snowbirds', display_order: 22 },
  { city_name: 'Maricopa', city_slug: 'maricopa', value_tier: 3, tier_name: 'Silver', price_monthly: 99, price_annual: 990, zip_codes: ['85138', '85139'], description: 'Affordable new construction', display_order: 23 },
  { city_name: 'San Tan Valley', city_slug: 'san-tan-valley', value_tier: 3, tier_name: 'Silver', price_monthly: 99, price_annual: 990, zip_codes: ['85140', '85143'], description: 'Growing southeast valley', display_order: 24 },
  { city_name: 'Yuma', city_slug: 'yuma', value_tier: 2, tier_name: 'Bronze', price_monthly: 29, price_annual: 290, zip_codes: ['85364', '85365', '85366', '85367'], description: 'Border community, military base', display_order: 25 },
  { city_name: 'Sierra Vista', city_slug: 'sierra-vista', value_tier: 2, tier_name: 'Bronze', price_monthly: 29, price_annual: 290, zip_codes: ['85635', '85636', '85650'], description: 'Fort Huachuca area', display_order: 26 },
  { city_name: 'Casa Grande', city_slug: 'casa-grande', value_tier: 2, tier_name: 'Bronze', price_monthly: 29, price_annual: 290, zip_codes: ['85122', '85193', '85194'], description: 'Interstate corridor, growing', display_order: 27 },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🌵 Populating Arizona city pricing data...');

    // Delete existing data
    await supabase.from('arizona_city_pricing').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Insert all cities
    const { data, error } = await supabase
      .from('arizona_city_pricing')
      .insert(ARIZONA_CITIES)
      .select();

    if (error) {
      console.error('❌ Error inserting pricing data:', error);
      throw error;
    }

    console.log(`✅ Successfully inserted ${data.length} cities`);

    return new Response(
      JSON.stringify({ success: true, cities: data.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Error in setup-arizona-pricing:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});