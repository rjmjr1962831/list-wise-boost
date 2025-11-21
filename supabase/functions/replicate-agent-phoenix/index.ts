import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { professionalId } = await req.json();

    if (!professionalId) {
      throw new Error('professionalId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Step 1: Enriching agent with memo23...');
    
    // First, enrich the existing record using memo23
    const enrichResponse = await supabase.functions.invoke('fetch-single-memo23-agent', {
      body: { professionalId }
    });

    if (enrichResponse.error) {
      throw new Error(`Failed to enrich agent: ${enrichResponse.error.message}`);
    }

    console.log('✅ Agent enriched successfully');
    console.log('Step 2: Fetching enriched data...');

    // Get the enriched professional data
    const { data: enrichedPro, error: fetchError } = await supabase
      .from('professionals')
      .select('*')
      .eq('id', professionalId)
      .single();

    if (fetchError || !enrichedPro) {
      throw new Error(`Failed to fetch enriched data: ${fetchError?.message}`);
    }

    console.log(`✅ Fetched enriched data for ${enrichedPro.name}`);
    console.log('Step 3: Getting Phoenix metro markets...');

    // Get all Phoenix metro market cities
    const { data: cities, error: citiesError } = await supabase
      .from('cities')
      .select('id, name, slug')
      .eq('state', 'Arizona')
      .in('slug', ['phoenix', 'scottsdale', 'tempe', 'mesa', 'chandler', 'gilbert', 'glendale']);

    if (citiesError) {
      throw new Error(`Failed to fetch cities: ${citiesError.message}`);
    }

    console.log(`✅ Found ${cities.length} Phoenix metro markets`);
    console.log('Step 4: Replicating agent across markets...');

    // Get category_id for top10realestateagents
    const { data: category, error: catError } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'top10realestateagents')
      .single();

    if (catError || !category) {
      throw new Error(`Failed to fetch category: ${catError?.message}`);
    }

    const results = [];

    for (const city of cities) {
      // Check if agent already exists in this market
      const { data: existing } = await supabase
        .from('professionals')
        .select('id')
        .eq('city_id', city.id)
        .eq('category_id', category.id)
        .eq('name', enrichedPro.name)
        .maybeSingle();

      if (existing) {
        console.log(`Updating existing record in ${city.name}...`);
        
        // Update existing record with enriched data
        const { error: updateError } = await supabase
          .from('professionals')
          .update({
            // Contact info
            phone: enrichedPro.phone,
            email: enrichedPro.email,
            website: enrichedPro.website,
            
            // Zillow data
            review_stars_rating: enrichedPro.review_stars_rating,
            num_total_reviews: enrichedPro.num_total_reviews,
            encoded_zuid: enrichedPro.encoded_zuid,
            zuid: enrichedPro.zuid,
            screen_name: enrichedPro.screen_name,
            zillow_profile_url: enrichedPro.zillow_profile_url,
            zillow_data_fetched_at: new Date().toISOString(),
            
            // Profile data
            image_url: enrichedPro.image_url,
            profile_image_id: enrichedPro.profile_image_id,
            get_to_know_me: enrichedPro.get_to_know_me,
            description: enrichedPro.description,
            sidebar_video_url: enrichedPro.sidebar_video_url,
            
            // Business info
            business_name: enrichedPro.business_name,
            company: enrichedPro.company,
            business_address: enrichedPro.business_address,
            address: enrichedPro.address,
            zip_code: enrichedPro.zip_code,
            
            // Stats
            total_sales: enrichedPro.total_sales,
            current_listings: enrichedPro.current_listings,
            years_experience: enrichedPro.years_experience,
            
            // License
            license_number: enrichedPro.license_number,
            license_verified_at: enrichedPro.license_verified_at,
            
            // Structured data
            agent_licenses: enrichedPro.agent_licenses,
            agent_sales_stats: enrichedPro.agent_sales_stats,
            phone_numbers: enrichedPro.phone_numbers,
            professional_information: enrichedPro.professional_information,
            professional_data: enrichedPro.professional_data,
            ratings: enrichedPro.ratings,
            specialty: enrichedPro.specialty,
            badges: enrichedPro.badges,
            
            // Meta
            is_premier_agent: enrichedPro.is_premier_agent,
            is_top_agent: enrichedPro.is_top_agent,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error(`Error updating ${city.name}:`, updateError);
          results.push({ city: city.name, status: 'error', error: updateError.message });
        } else {
          console.log(`✅ Updated ${city.name}`);
          results.push({ city: city.name, status: 'updated', id: existing.id });
        }
      } else {
        console.log(`Creating new record in ${city.name}...`);
        
        // Create new record for this market
        const { data: newPro, error: insertError } = await supabase
          .from('professionals')
          .insert({
            name: enrichedPro.name,
            city_id: city.id,
            category_id: category.id,
            rank: 10, // Add at end of list
            type: enrichedPro.type,
            
            // Contact info
            phone: enrichedPro.phone,
            email: enrichedPro.email,
            website: enrichedPro.website,
            
            // Zillow data
            review_stars_rating: enrichedPro.review_stars_rating,
            num_total_reviews: enrichedPro.num_total_reviews,
            encoded_zuid: enrichedPro.encoded_zuid,
            zuid: enrichedPro.zuid,
            screen_name: enrichedPro.screen_name,
            zillow_profile_url: enrichedPro.zillow_profile_url,
            zillow_data_fetched_at: new Date().toISOString(),
            
            // Profile data
            image_url: enrichedPro.image_url,
            profile_image_id: enrichedPro.profile_image_id,
            get_to_know_me: enrichedPro.get_to_know_me,
            description: enrichedPro.description,
            sidebar_video_url: enrichedPro.sidebar_video_url,
            
            // Business info
            business_name: enrichedPro.business_name,
            company: enrichedPro.company,
            business_address: enrichedPro.business_address,
            address: enrichedPro.address,
            zip_code: enrichedPro.zip_code,
            
            // Stats
            total_sales: enrichedPro.total_sales,
            current_listings: enrichedPro.current_listings,
            years_experience: enrichedPro.years_experience,
            
            // License
            license_number: enrichedPro.license_number,
            license_verified_at: enrichedPro.license_verified_at,
            
            // Structured data
            agent_licenses: enrichedPro.agent_licenses,
            agent_sales_stats: enrichedPro.agent_sales_stats,
            phone_numbers: enrichedPro.phone_numbers,
            professional_information: enrichedPro.professional_information,
            professional_data: enrichedPro.professional_data,
            ratings: enrichedPro.ratings,
            specialty: enrichedPro.specialty,
            badges: enrichedPro.badges,
            
            // Meta
            is_premier_agent: enrichedPro.is_premier_agent,
            is_top_agent: enrichedPro.is_top_agent,
            active: true
          })
          .select()
          .single();

        if (insertError) {
          console.error(`Error inserting into ${city.name}:`, insertError);
          results.push({ city: city.name, status: 'error', error: insertError.message });
        } else {
          console.log(`✅ Created in ${city.name}`);
          results.push({ city: city.name, status: 'created', id: newPro.id });
        }
      }
    }

    console.log('✅ Replication complete!');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully replicated ${enrichedPro.name} across ${cities.length} Phoenix metro markets`,
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
