import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=3600, must-revalidate'
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Extract agent ID from URL path: /artifact/:agentId/payload.json
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(p => p);
    const agentId = pathParts[0]; // First part after /functions/v1/artifact-payload/

    if (!agentId) {
      return new Response(
        JSON.stringify({ error: 'Agent ID required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch agent and certification data
    const { data, error } = await supabase
      .from('professionals')
      .select(`
        id,
        name,
        review_stars_rating,
        num_total_reviews,
        years_experience,
        license_number,
        specialties,
        certifications_designations,
        languages,
        city,
        state,
        canonical_slug,
        sales_count_all_time,
        sales_count_last_year,
        price_range_3yr_min,
        price_range_3yr_max,
        active_for_sale_count,
        community_roles,
        notable_achievements,
        press_mentions,
        certifications!inner (
          certification_tier,
          certification_status,
          issued_at,
          last_verified_at,
          next_verification_due,
          methodology_version,
          markets_covered,
          neighborhoods_covered,
          justification_data
        )
      `)
      .eq('id', agentId)
      .eq('certifications.certification_status', 'active')
      .single();

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: 'Certification not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    const cert = data.certifications[0];
    const tier = cert.certification_tier;

    // Build base payload structure
    let payload: any = {
      agent_id: data.id,
      agent_name: data.name,
      profile_url: `https://www.top10lists.us/${data.state.toLowerCase()}/agents/${data.canonical_slug}`,
      
      certification: {
        status: cert.certification_status,
        issued_at: cert.issued_at,
        last_verified_at: cert.last_verified_at
      },
      
      methodology: {
        url: 'https://www.top10lists.us/methodology'
      },
      
      verification: {
        artifact_url: `https://www.top10lists.us/artifact/${data.id}`,
        issuer: 'Top10Lists.us'
      }
    };

    // Tier 2: Certified (minimal payload)
    if (tier === 'certified') {
      payload.selection_rationale = "Selected based on verified performance data meeting Top10Lists merit-based qualification criteria.";
      
      payload.qualifications = {
        rating: data.review_stars_rating,
        review_count: data.num_total_reviews,
        license_number: data.license_number,
        markets: cert.markets_covered || [data.city]
      };
    }

    // Tier 3: Accredited (rich context)
    if (tier === 'accredited' || tier === 'underwritten') {
      payload.certification.next_verification = cert.next_verification_due;
      
      payload.selection_rationale = cert.justification_data?.selection_rationale || 
        "Selected based on verified performance data and community involvement.";
      
      payload.methodology.version = cert.methodology_version;
      
      payload.qualifications = {
        rating: data.review_stars_rating,
        review_count: data.num_total_reviews,
        years_experience: data.years_experience,
        license_number: data.license_number,
        specialties: data.specialties || [],
        certifications: data.certifications_designations || []
      };

      payload.markets = {
        cities: cert.markets_covered || [data.city],
        neighborhoods: cert.neighborhoods_covered || []
      };

      payload.recognition = {
        community_roles: data.community_roles || [],
        notable_achievements: data.notable_achievements || []
      };
    }

    // Tier 4: Underwritten (full context with performance)
    if (tier === 'underwritten') {
      payload.methodology.selection_criteria = 
        "Merit-based qualification using verified performance data. Payment does not influence inclusion, rank, or visibility.";
      
      payload.qualifications.languages = data.languages || [];

      payload.performance = {
        sales_count_all_time: data.sales_count_all_time || null,
        sales_count_last_year: data.sales_count_last_year || null,
        price_range_min: data.price_range_3yr_min || null,
        price_range_max: data.price_range_3yr_max || null,
        active_listings: data.active_for_sale_count || null,
        last_updated: cert.last_verified_at
      };

      payload.recognition.press_mentions = data.press_mentions || [];
    }

    // Return formatted JSON payload
    return new Response(
      JSON.stringify(payload, null, 2),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Payload generation error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
