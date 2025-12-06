import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map empty cities to their nearest metro cities
const CITY_METRO_MAPPING: Record<string, string> = {
  'Anthem': 'Phoenix',
  'Apache Junction': 'Mesa',
  'Avondale': 'Phoenix',
  'Buckeye': 'Goodyear',
  'Carefree': 'Scottsdale',
  'Casa Grande': 'Phoenix',
  'Cave Creek': 'Scottsdale',
  'Coolidge': 'Phoenix',
  'El Mirage': 'Glendale',
  'Florence': 'Mesa',
  'Fountain Hills': 'Scottsdale',
  'Gila Bend': 'Phoenix',
  'Gold Canyon': 'Mesa',
  'Laveen': 'Phoenix',
  'Litchfield Park': 'Goodyear',
  'Maricopa': 'Chandler',
  'New River': 'Phoenix',
  'Paradise Valley': 'Scottsdale',
  'Queen Creek': 'Gilbert',
  'Rio Verde': 'Scottsdale',
  'San Tan Valley': 'Gilbert',
  'Sun City': 'Surprise',
  'Sun City West': 'Surprise',
  'Sun Lakes': 'Chandler',
  'Tolleson': 'Phoenix',
  'West Valley': 'Phoenix',
  'Wickenburg': 'Phoenix',
  'Youngtown': 'Surprise',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Starting cross-linking process...');

    // Get the real estate agents category
    const { data: category, error: categoryError } = await supabaseClient
      .from('categories')
      .select('id')
      .eq('slug', 'top10realestateagents')
      .single();

    if (categoryError || !category) {
      throw new Error('Real Estate Agents category not found');
    }

    const categoryId = category.id;
    const results: Array<{ city: string, linked: number, metro: string }> = [];
    let totalLinked = 0;

    // Process each empty city
    for (const [emptyCity, metroCity] of Object.entries(CITY_METRO_MAPPING)) {
      console.log(`\n🔗 Processing ${emptyCity} → ${metroCity}`);

      // Get empty city ID
      const { data: emptyCityData, error: emptyCityError } = await supabaseClient
        .from('cities')
        .select('id, name')
        .eq('name', emptyCity)
        .eq('state', 'Arizona')
        .single();

      if (emptyCityError || !emptyCityData) {
        console.log(`⚠️ City not found: ${emptyCity}`);
        continue;
      }

      // Get metro city ID
      const { data: metroCityData, error: metroCityError } = await supabaseClient
        .from('cities')
        .select('id')
        .eq('name', metroCity)
        .eq('state', 'Arizona')
        .single();

      if (metroCityError || !metroCityData) {
        console.log(`⚠️ Metro city not found: ${metroCity}`);
        continue;
      }

      // Check if already has agents
      const { data: existingLinks, error: existingError } = await supabaseClient
        .from('professional_cities')
        .select('id')
        .eq('city_id', emptyCityData.id)
        .eq('active', true)
        .limit(1);

      if (existingError) {
        console.log(`⚠️ Error checking existing links for ${emptyCity}:`, existingError);
        continue;
      }

      if (existingLinks && existingLinks.length > 0) {
        console.log(`✓ ${emptyCity} already has agents, skipping`);
        continue;
      }

      // Get top 10 agents from metro city
      const { data: metroAgents, error: agentsError } = await supabaseClient
        .from('professional_cities')
        .select('professional_id, rank, professionals!inner(id, name, active, category_id)')
        .eq('city_id', metroCityData.id)
        .eq('active', true)
        .eq('professionals.active', true)
        .eq('professionals.category_id', categoryId)
        .order('rank', { ascending: true })
        .limit(10);

      if (agentsError || !metroAgents || metroAgents.length === 0) {
        console.log(`⚠️ No agents found in ${metroCity}`);
        continue;
      }

      console.log(`Found ${metroAgents.length} agents in ${metroCity}`);

      // Create professional_cities entries
      const newLinks = metroAgents.map((agent, index) => ({
        professional_id: agent.professional_id,
        city_id: emptyCityData.id,
        rank: index + 1,
        active: true,
      }));

      const { data: insertedLinks, error: insertError } = await supabaseClient
        .from('professional_cities')
        .insert(newLinks)
        .select();

      if (insertError) {
        console.log(`❌ Error linking agents to ${emptyCity}:`, insertError);
        continue;
      }

      const linkedCount = insertedLinks?.length || 0;
      totalLinked += linkedCount;
      results.push({
        city: emptyCity,
        linked: linkedCount,
        metro: metroCity,
      });

      console.log(`✓ Linked ${linkedCount} agents to ${emptyCity}`);
    }

    console.log(`\n✅ Cross-linking complete! Total agents linked: ${totalLinked}`);

    return new Response(
      JSON.stringify({
        success: true,
        total_linked: totalLinked,
        cities_processed: results.length,
        results: results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in cross-link-metro-agents:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.toString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
