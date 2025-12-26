import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Minimum qualification thresholds
const MIN_RATING = 4.8;
const MIN_REVIEWS = 20;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { state = 'CA', limit = 50, dry_run = false } = await req.json().catch(() => ({}));

    console.log(`Promote to professionals - State: ${state}, Limit: ${limit}, Dry run: ${dry_run}`);

    // Find qualified agents in state_licenses that haven't been promoted yet
    const { data: qualifiedAgents, error: fetchError } = await supabase
      .from('state_licenses')
      .select('*')
      .eq('state', state)
      .gte('zillow_rating', MIN_RATING)
      .gte('zillow_reviews', MIN_REVIEWS)
      .not('zillow_scraped_at', 'is', null)
      .limit(limit);

    if (fetchError) {
      console.error('Error fetching qualified agents:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${qualifiedAgents?.length || 0} qualified agents in state_licenses`);

    if (!qualifiedAgents || qualifiedAgents.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No qualified agents found to promote',
        promoted: 0,
        skipped: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (dry_run) {
      return new Response(JSON.stringify({
        success: true,
        dry_run: true,
        would_promote: qualifiedAgents.length,
        agents: qualifiedAgents.map(a => ({
          name: a.name,
          license_number: a.license_number,
          rating: a.zillow_rating,
          reviews: a.zillow_reviews
        }))
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get default city and category IDs for the state
    const { data: defaultCity } = await supabase
      .from('cities')
      .select('id')
      .ilike('state', state === 'CA' ? 'California' : state === 'AZ' ? 'Arizona' : state === 'TX' ? 'Texas' : state)
      .limit(1)
      .maybeSingle();

    const { data: defaultCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'real-estate-agents')
      .maybeSingle();

    if (!defaultCity || !defaultCategory) {
      throw new Error(`Missing default city or category for state: ${state}`);
    }

    let promoted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const agent of qualifiedAgents) {
      try {
        // Check if agent already exists in professionals by license number
        const { data: existing } = await supabase
          .from('professionals')
          .select('id, license_number')
          .eq('license_number', agent.license_number)
          .maybeSingle();

        const professionalData = {
          name: agent.name,
          email: agent.email,
          phone: agent.phone,
          website: agent.website,
          description: agent.bio,
          company: agent.brokerage_name,
          license_number: agent.license_number,
          license_type: agent.license_type,
          years_experience: agent.years_experience,
          total_sales: agent.total_sales,
          review_stars_rating: agent.zillow_rating,
          num_total_reviews: agent.zillow_reviews,
          zillow_profile_url: agent.zillow_url,
          zillow_data_fetched_at: agent.zillow_scraped_at,
          specialty: agent.specialties ? agent.specialties.split(',').map((s: string) => s.trim()) : null,
          address: agent.city ? `${agent.city}, ${agent.state}` : null,
          active: true,
          type: 'individual',
          city_id: defaultCity.id,
          category_id: defaultCategory.id,
          rank: 999, // Default rank, can be updated later
          agent_sales_stats: {
            salesLast12Months: agent.sales_last_12_months,
            avgPrice: agent.avg_price,
            priceRangeMin: agent.price_range_min,
            priceRangeMax: agent.price_range_max
          },
          reviews_data: agent.zillow_reviews_json ? {
            zillow_reviews: agent.zillow_reviews_json
          } : null
        };

        if (existing) {
          // Update existing professional
          const { error: updateError } = await supabase
            .from('professionals')
            .update(professionalData)
            .eq('id', existing.id);

          if (updateError) {
            console.error(`Error updating ${agent.name}:`, updateError);
            errors.push(`Update failed for ${agent.name}: ${updateError.message}`);
            skipped++;
          } else {
            console.log(`Updated existing professional: ${agent.name}`);
            promoted++;
          }
        } else {
          // Insert new professional
          const { error: insertError } = await supabase
            .from('professionals')
            .insert(professionalData);

          if (insertError) {
            console.error(`Error inserting ${agent.name}:`, insertError);
            errors.push(`Insert failed for ${agent.name}: ${insertError.message}`);
            skipped++;
          } else {
            console.log(`Promoted new professional: ${agent.name}`);
            promoted++;
          }
        }
      } catch (agentError: unknown) {
        const errMsg = agentError instanceof Error ? agentError.message : String(agentError);
        console.error(`Error processing ${agent.name}:`, agentError);
        errors.push(`Error for ${agent.name}: ${errMsg}`);
        skipped++;
      }
    }

    console.log(`Promotion complete - Promoted: ${promoted}, Skipped: ${skipped}`);

    return new Response(JSON.stringify({
      success: true,
      promoted,
      skipped,
      total_qualified: qualifiedAgents.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Promoted ${promoted} agents to professionals table. Pipedrive sync will trigger automatically.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Promote to professionals error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errMsg
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
