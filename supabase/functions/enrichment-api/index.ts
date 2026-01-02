import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-enrichment-key',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate custom API key
    const apiKey = req.headers.get('x-enrichment-key');
    const expectedKey = Deno.env.get('ENRICHMENT_API_KEY');
    
    if (!apiKey || apiKey !== expectedKey) {
      console.error('enrichment-api - Invalid or missing API key');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or missing X-Enrichment-Key header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // GET: Fetch professionals needing enrichment
    if (req.method === 'GET' && action === 'fetch') {
      const limit = parseInt(url.searchParams.get('limit') || '100');
      
      console.log(`enrichment-api - Fetching up to ${limit} professionals needing enrichment`);
      
      const { data, error } = await supabase
        .from('professionals')
        .select(`
          id,
          name,
          zillow_profile_url,
          city_id,
          cities (
            name,
            state
          )
        `)
        .is('zillow_data_fetched_at', null)
        .not('zillow_profile_url', 'is', null)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('enrichment-api - Database error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`enrichment-api - Returning ${data?.length || 0} professionals`);
      
      return new Response(
        JSON.stringify({ professionals: data, count: data?.length || 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST: Update a professional with enrichment data
    if (req.method === 'POST' && action === 'update') {
      const body = await req.json();
      const { professional_id, ...updateData } = body;

      if (!professional_id) {
        return new Response(
          JSON.stringify({ error: 'professional_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`enrichment-api - Updating professional ${professional_id}`);

      // Allowed fields that can be updated
      const allowedFields = [
        'description',
        'years_experience',
        'total_sales',
        'current_listings',
        'agent_sales_stats',
        'past_sales',
        'zuid',
        'encoded_zuid',
        'screen_name',
        'zillow_data_fetched_at',
        'specialty',
        'certifications',
        'languages',
        'service_areas',
        'reviews_data',
        'is_top_agent',
        'is_premier_agent',
        'badges',
        'sidebar_video_url',
        'platform_reviews',
        'num_total_reviews',
        'review_stars_rating',
        'has_recent_review',
        'most_recent_review_date',
        'phone',
        'email',
        'website',
        'company',
        'business_name',
        'address',
        'zip_code',
        'image_url',
        'headline',
        'get_to_know_me',
        'review_link',
        'profile_link',
        'license_number',
        'license_type',
        'license_status',
        'professional_data',
        'professional_information',
        'agent_licenses',
        'phone_numbers',
        'business_address',
        'ratings',
        'team_display_information',
        'raw_scraper_data',
        'synthesized_bio',
        'profile_last_synthesized_at'
      ];

      // Filter to only allowed fields
      const sanitizedUpdate: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (field in updateData) {
          sanitizedUpdate[field] = updateData[field];
        }
      }

      if (Object.keys(sanitizedUpdate).length === 0) {
        return new Response(
          JSON.stringify({ error: 'No valid fields to update' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('professionals')
        .update(sanitizedUpdate)
        .eq('id', professional_id)
        .select('id, name, review_stars_rating, num_total_reviews, synthesized_bio, active')
        .single();

      if (error) {
        console.error('enrichment-api - Update error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`enrichment-api - Successfully updated professional ${professional_id}`);

      // Check if agent is qualified (4.8+ rating AND 20+ reviews) and needs synthesis
      const isQualified = data.review_stars_rating >= 4.8 && data.num_total_reviews >= 20;
      let synthesisTriggerResult = null;
      
      if (isQualified && !data.synthesized_bio) {
        console.log(`enrichment-api - Agent ${professional_id} is QUALIFIED, triggering synthesis...`);
        
        // Set active = true for qualified agents
        await supabase
          .from('professionals')
          .update({ active: true })
          .eq('id', professional_id);
        
        // Trigger synthesis in background
        try {
          const synthesisResponse = await fetch(`${supabaseUrl}/functions/v1/synthesize-agent-profile`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ professional_id })
          });
          
          if (synthesisResponse.ok) {
            synthesisTriggerResult = 'triggered';
            console.log(`enrichment-api - Synthesis triggered for ${professional_id}`);
          } else {
            synthesisTriggerResult = `failed: ${synthesisResponse.status}`;
            console.error(`enrichment-api - Synthesis trigger failed: ${synthesisResponse.status}`);
          }
        } catch (synthError) {
          synthesisTriggerResult = `error: ${synthError instanceof Error ? synthError.message : 'unknown'}`;
          console.error('enrichment-api - Synthesis trigger error:', synthError);
        }
      } else if (isQualified) {
        console.log(`enrichment-api - Agent ${professional_id} is QUALIFIED but already has bio`);
        synthesisTriggerResult = 'skipped_has_bio';
      } else {
        console.log(`enrichment-api - Agent ${professional_id} is NOT qualified (rating: ${data.review_stars_rating}, reviews: ${data.num_total_reviews})`);
        synthesisTriggerResult = 'not_qualified';
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          updated: data, 
          fields_updated: Object.keys(sanitizedUpdate),
          qualified: isQualified,
          synthesis: synthesisTriggerResult
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET: Fetch licenses needing Zillow scraping
    if (req.method === 'GET' && action === 'fetch_licenses') {
      const limit = parseInt(url.searchParams.get('limit') || '100');
      
      console.log(`enrichment-api - Fetching up to ${limit} licenses needing Zillow scraping`);
      
      const { data, error } = await supabase
        .from('state_licenses')
        .select('id, name, city, state, license_number')
        .is('zillow_scraped_at', null)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('enrichment-api - Database error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`enrichment-api - Returning ${data?.length || 0} licenses`);
      
      return new Response(
        JSON.stringify({ licenses: data, count: data?.length || 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST: Update a license with Zillow scrape data
    if (req.method === 'POST' && action === 'update_license') {
      const body = await req.json();
      const { 
        license_id, 
        zillow_url, 
        zillow_rating, 
        zillow_reviews, 
        zillow_scraped_at, 
        zillow_status, 
        zillow_error 
      } = body;

      if (!license_id) {
        return new Response(
          JSON.stringify({ error: 'license_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`enrichment-api - Updating license ${license_id} with Zillow data`);

      const updateData: Record<string, unknown> = {
        zillow_scraped_at: zillow_scraped_at || new Date().toISOString(),
        zillow_status: zillow_status || 'found'
      };

      if (zillow_url !== undefined) updateData.zillow_url = zillow_url;
      if (zillow_rating !== undefined) updateData.zillow_rating = zillow_rating;
      if (zillow_reviews !== undefined) updateData.zillow_reviews = zillow_reviews;
      if (zillow_error !== undefined) updateData.zillow_error = zillow_error;

      const { data, error } = await supabase
        .from('state_licenses')
        .update(updateData)
        .eq('id', license_id)
        .select('id, name, zillow_rating, zillow_reviews, zillow_status')
        .single();

      if (error) {
        console.error('enrichment-api - Update license error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`enrichment-api - Successfully updated license ${license_id}: rating=${zillow_rating}, reviews=${zillow_reviews}`);

      // Check if qualified for promotion
      const isQualified = (zillow_rating >= 4.8) && (zillow_reviews >= 20);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          updated: data,
          qualified: isQualified,
          message: isQualified ? 'Qualified! Call promote_to_professional to create agent.' : 'Not qualified (needs 4.8+ rating AND 20+ reviews)'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST: Promote qualified license to professionals table
    if (req.method === 'POST' && action === 'promote_to_professional') {
      const body = await req.json();
      const { license_id } = body;

      if (!license_id) {
        return new Response(
          JSON.stringify({ error: 'license_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`enrichment-api - Promoting license ${license_id} to professional`);

      // Fetch the license data
      const { data: license, error: fetchError } = await supabase
        .from('state_licenses')
        .select('*')
        .eq('id', license_id)
        .single();

      if (fetchError || !license) {
        console.error('enrichment-api - License not found:', fetchError);
        return new Response(
          JSON.stringify({ error: 'License not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check qualification
      if ((license.zillow_rating || 0) < 4.8 || (license.zillow_reviews || 0) < 20) {
        console.log(`enrichment-api - License ${license_id} not qualified: rating=${license.zillow_rating}, reviews=${license.zillow_reviews}`);
        return new Response(
          JSON.stringify({ 
            error: 'Not qualified',
            zillow_rating: license.zillow_rating,
            zillow_reviews: license.zillow_reviews,
            required: '4.8+ rating AND 20+ reviews'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if already exists in professionals by license_number
      const { data: existing } = await supabase
        .from('professionals')
        .select('id, name')
        .eq('license_number', license.license_number)
        .maybeSingle();

      if (existing) {
        console.log(`enrichment-api - Professional already exists for license ${license.license_number}: ${existing.id}`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            action: 'already_exists',
            professional_id: existing.id,
            name: existing.name
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get city_id from cities table based on license city name
      let cityId = null;
      if (license.city) {
        const { data: cityData } = await supabase
          .from('cities')
          .select('id')
          .ilike('name', license.city)
          .eq('state_slug', license.state?.toLowerCase() || 'arizona')
          .maybeSingle();
        
        cityId = cityData?.id;
      }

      // Get default category (Real Estate Agent)
      const { data: categoryData } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', 'top10realestateagents')
        .single();

      if (!categoryData) {
        console.error('enrichment-api - Default category not found');
        return new Response(
          JSON.stringify({ error: 'Default category not found' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If no city found, try to create or get a default
      if (!cityId) {
        // Try Phoenix as default for Arizona
        const { data: defaultCity } = await supabase
          .from('cities')
          .select('id')
          .eq('slug', 'phoenix')
          .single();
        
        cityId = defaultCity?.id;
      }

      if (!cityId) {
        console.error('enrichment-api - Could not determine city_id');
        return new Response(
          JSON.stringify({ error: 'Could not determine city for this license' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create the professional record
      const professionalData = {
        name: license.name,
        license_number: license.license_number,
        license_type: license.license_type,
        email: license.email,
        phone: license.phone,
        website: license.website,
        company: license.brokerage_name,
        zillow_profile_url: license.zillow_url,
        review_stars_rating: license.zillow_rating,
        num_total_reviews: license.zillow_reviews,
        years_experience: license.years_experience,
        city_id: cityId,
        category_id: categoryData.id,
        type: 'individual',
        rank: 999, // Will be recalculated
        active: true,
        zillow_data_fetched_at: new Date().toISOString()
      };

      const { data: newProfessional, error: insertError } = await supabase
        .from('professionals')
        .insert(professionalData)
        .select('id, name, short_code, profile_link')
        .single();

      if (insertError) {
        console.error('enrichment-api - Insert professional error:', insertError);
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`enrichment-api - Created professional ${newProfessional.id} from license ${license_id}`);

      // Trigger synthesis for the new professional
      let synthesisTriggerResult = null;
      try {
        const synthesisResponse = await fetch(`${supabaseUrl}/functions/v1/synthesize-agent-profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ professional_id: newProfessional.id })
        });
        
        if (synthesisResponse.ok) {
          synthesisTriggerResult = 'triggered';
          console.log(`enrichment-api - Synthesis triggered for new professional ${newProfessional.id}`);
        } else {
          synthesisTriggerResult = `failed: ${synthesisResponse.status}`;
        }
      } catch (synthError) {
        synthesisTriggerResult = `error: ${synthError instanceof Error ? synthError.message : 'unknown'}`;
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          action: 'created',
          professional_id: newProfessional.id,
          name: newProfessional.name,
          short_code: newProfessional.short_code,
          profile_link: newProfessional.profile_link,
          synthesis: synthesisTriggerResult
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Invalid action
    return new Response(
      JSON.stringify({ 
        error: 'Invalid action',
        usage: {
          fetch: 'GET ?action=fetch&limit=100 - Fetch professionals needing enrichment',
          update: 'POST ?action=update - Update professional with enrichment data',
          fetch_licenses: 'GET ?action=fetch_licenses&limit=100 - Fetch licenses needing Zillow scrape',
          update_license: 'POST ?action=update_license - Update license with Zillow data',
          promote_to_professional: 'POST ?action=promote_to_professional - Promote qualified license to professional'
        }
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('enrichment-api - Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
