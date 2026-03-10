// DEPRECATED — This edge function is no longer in active use. See docs/takeaways for context.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXECUTION_TIMEOUT_MS = 4 * 60 * 1000; // 4 minutes
const BATCH_SIZE = 50; // Sync 50 agents at a time

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

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
    const limit = payload.limit || BATCH_SIZE;
    const offset = payload.offset || 0;
    const filters = payload.filters || {};

    console.log(`Bulk sync starting: limit=${limit}, offset=${offset}`);

    // Build query
    let query = supabase
      .from('professionals')
      .select('*')
      .eq('active', true)
      .not('email', 'is', null);

    // Apply filters
    if (filters.state_slug) {
      query = query.eq('state_slug', filters.state_slug);
    }
    if (filters.funnel_status) {
      query = query.eq('funnel_status', filters.funnel_status);
    }
    if (filters.tier_level === 'certified') {
      query = query.or('paid_cities.not.is.null,monthly_revenue_cents.gt.0');
    }

    // Fetch batch
    const { data: professionals, error: fetchError } = await query
      .range(offset, offset + limit - 1);

    if (fetchError) {
      console.error("Failed to fetch professionals:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch professionals", details: fetchError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!professionals || professionals.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "No professionals to sync",
          offset: offset,
          count: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetched ${professionals.length} professionals`);

    // Helper functions
    const getTier = (funnelStatus: string): string => {
      const status = (funnelStatus || '').toLowerCase().trim();
      return (status === 'approved' || status === 'edit_complete') ? 'hot' : 'warm';
    };

    const getTierLevel = (paidCities: any[], monthlyRevenue: number, subscriptionStatus: string): string => {
      const hasPaidCities = paidCities && paidCities.length > 0;
      const hasRevenue = monthlyRevenue && monthlyRevenue > 0;
      const isSubscribed = subscriptionStatus && subscriptionStatus !== 'none';
      return (hasPaidCities || hasRevenue || isSubscribed) ? 'certified' : 'listed';
    };

    const getTrustSignalScore = (tierLevel: string, tier: string): number => {
      if (tierLevel === 'certified') return 100;
      if (tier === 'hot') return 75;
      return 50;
    };

    // Sync each professional
    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[]
    };

    for (const professional of professionals) {
      // Check timeout
      if (Date.now() - startTime > EXECUTION_TIMEOUT_MS) {
        console.log(`Timeout reached after ${results.success + results.failed} agents`);
        return new Response(
          JSON.stringify({
            success: false,
            message: "Execution timeout - use pagination to continue",
            offset: offset,
            processed: results.success + results.failed,
            results: results
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        // Parse name
        const name = professional.name || '';
        const nameParts = name.split(' ', 2);
        const firstName = nameParts[0] || '';
        const lastName = nameParts[1] || '';

        // Build data
        const citiesServed = Array.isArray(professional.served_cities) 
          ? professional.served_cities.join(', ').substring(0, 255)
          : '';

        const specialty = Array.isArray(professional.specialty)
          ? professional.specialty.join(', ').substring(0, 255)
          : '';

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

        // Call Instantly API V2
        const response = await fetch('https://api.instantly.ai/api/v2/leads/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(instantlyData),
        });

        if (response.ok) {
          results.success++;
        } else {
          const error = await response.json();
          results.failed++;
          results.errors.push({ email: professional.email, error });
        }

      } catch (error) {
        results.failed++;
        results.errors.push({ email: professional.email, error: error.message });
      }

      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const hasMore = professionals.length === limit;
    const nextOffset = hasMore ? offset + limit : null;

    return new Response(
      JSON.stringify({
        success: true,
        offset: offset,
        limit: limit,
        processed: results.success + results.failed,
        successful: results.success,
        failed: results.failed,
        has_more: hasMore,
        next_offset: nextOffset,
        errors: results.errors.length > 0 ? results.errors.slice(0, 10) : [],
        execution_time_ms: Date.now() - startTime
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Bulk sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
