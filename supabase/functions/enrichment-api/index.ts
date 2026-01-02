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

    // Invalid action
    return new Response(
      JSON.stringify({ 
        error: 'Invalid action',
        usage: {
          fetch: 'GET /enrichment-api?action=fetch&limit=100',
          update: 'POST /enrichment-api?action=update with JSON body'
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
