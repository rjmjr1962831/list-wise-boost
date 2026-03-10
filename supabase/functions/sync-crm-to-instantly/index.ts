// DEPRECATED — This edge function is no longer in active use. See docs/takeaways for context.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProfessionalUpdate {
  id: string;
  name?: string;
  email: string;
  phone?: string;
  state_slug?: string;
  served_cities?: string[];
  company?: string;
  business_name?: string;
  funnel_status?: string;
  review_stars_rating?: number;
  num_total_reviews?: number;
  specialty?: string[];
  canonical_slug?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const INSTANTLY_API_KEY = Deno.env.get("INSTANTLY_API_KEY");
    
    if (!INSTANTLY_API_KEY) {
      console.error("INSTANTLY_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Instantly API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const payload = await req.json();
    const professionalId = payload.professional_id;
    const action = payload.action || 'update'; // 'update', 'add', 'delete'

    if (!professionalId) {
      return new Response(
        JSON.stringify({ error: "professional_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch professional data
    const { data: professional, error: fetchError } = await supabase
      .from('professionals')
      .select('*')
      .eq('id', professionalId)
      .single();

    if (fetchError || !professional) {
      console.error("Failed to fetch professional:", fetchError);
      return new Response(
        JSON.stringify({ error: "Professional not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip if no email
    if (!professional.email) {
      return new Response(
        JSON.stringify({ status: "skipped", reason: "no email" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine tier based on funnel_status (certification status)
    const getTier = (funnelStatus: string): string => {
      const status = (funnelStatus || '').toLowerCase().trim();
      if (status === 'approved' || status === 'edit_complete') {
        return 'hot';
      }
      return 'warm';
    };

    // Determine tier level based on subscription (listed/certified)
    const getTierLevel = (paidCities: any[], monthlyRevenue: number, subscriptionStatus: string): string => {
      const hasPaidCities = paidCities && paidCities.length > 0;
      const hasRevenue = monthlyRevenue && monthlyRevenue > 0;
      const isSubscribed = subscriptionStatus && subscriptionStatus !== 'none';
      
      if (hasPaidCities || hasRevenue || isSubscribed) {
        return 'certified';
      }
      return 'listed';
    };

    // Calculate trust signal score
    const getTrustSignalScore = (tierLevel: string, tier: string): number => {
      if (tierLevel === 'certified') {
        return 100; // Paying customer
      }
      if (tier === 'hot') {
        return 75; // Approved/certified profile
      }
      return 50; // Welcome/warm
    };

    // Parse name into first/last
    const name = professional.name || '';
    const nameParts = name.split(' ', 2);
    const firstName = nameParts[0] || '';
    const lastName = nameParts[1] || '';

    // Build cities served string (truncate at 255 chars)
    const citiesServed = Array.isArray(professional.served_cities) 
      ? professional.served_cities.join(', ').substring(0, 255)
      : '';

    // Build specialty string (truncate at 255 chars)
    const specialty = Array.isArray(professional.specialty)
      ? professional.specialty.join(', ').substring(0, 255)
      : '';

    // Build profile URL
    const profileUrl = professional.canonical_slug && professional.state_slug
      ? `https://www.top10lists.us/${professional.state_slug}/agents/${professional.canonical_slug}`
      : '';

    const tier = getTier(professional.funnel_status);
    const tierLevel = getTierLevel(
      professional.paid_cities,
      professional.monthly_revenue_cents,
      professional.subscription_status
    );
    const trustSignalScore = getTrustSignalScore(tierLevel, tier);
    const logarithmicBoost = tierLevel === 'certified';

    // Prepare data for Instantly API V2
    const instantlyData = {
      api_key: INSTANTLY_API_KEY,
      email: professional.email,
      first_name: firstName,
      last_name: lastName,
      company_name: professional.company || professional.business_name || '',
      phone: professional.phone || '',
      custom_variables: {
        cities_served: citiesServed,
        specialty: specialty,
        rating: String(professional.review_stars_rating || ''),
        review_count: String(professional.num_total_reviews || ''),
        tier: tier,
        tier_level: tierLevel,
        trust_signal_score: String(trustSignalScore),
        logarithmic_boost: String(logarithmicBoost),
        funnel_status: professional.funnel_status || 'welcome',
        profile_url: profileUrl,
        state: (professional.state_slug || '').toUpperCase(),
        business_city: professional.business_city || '',
        business_state: professional.business_state || '',
      }
    };

    // Determine Instantly API V2 endpoint
    let instantlyUrl = '';
    let method = 'POST';
    
    if (action === 'delete') {
      instantlyUrl = 'https://api.instantly.ai/api/v2/leads/delete';
      method = 'DELETE';
    } else {
      // V2 uses /api/v2/leads/add for both add and update (upsert)
      instantlyUrl = 'https://api.instantly.ai/api/v2/leads/add';
    }

    console.log(`Syncing to Instantly V2: ${action} for ${professional.email}`);

    // Call Instantly API V2
    const instantlyResponse = await fetch(instantlyUrl, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(instantlyData),
    });

    const instantlyResult = await instantlyResponse.json();

    if (!instantlyResponse.ok) {
      console.error("Instantly API V2 error:", instantlyResult);
      return new Response(
        JSON.stringify({ 
          error: "Instantly API error", 
          details: instantlyResult,
          status: instantlyResponse.status
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Synced to Instantly V2: ${professional.email}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        action: action,
        email: professional.email,
        tier: tier,
        tier_level: tierLevel,
        trust_signal_score: trustSignalScore,
        logarithmic_boost: logarithmicBoost,
        instantly_response: instantlyResult
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
