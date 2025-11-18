import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting scheduled agent stats refresh...');

    // Calculate date 14 days ago
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    // Get all professionals that need refreshing:
    // - Have zillow_profile_url OR have a name (can be matched via fetch-zillow-agents)
    // - Data is older than 14 days or never fetched
    const { data: professionals, error: profError } = await supabase
      .from('professionals')
      .select(`
        id,
        name,
        zillow_profile_url,
        zillow_data_fetched_at,
        cities!inner(name, state, state_slug)
      `)
      .eq('active', true)
      .or(`zillow_data_fetched_at.is.null,zillow_data_fetched_at.lt.${fourteenDaysAgo.toISOString()}`)
      .limit(100); // Process in batches to avoid timeouts

    if (profError) {
      throw new Error(`Failed to fetch professionals: ${profError.message}`);
    }

    if (!professionals || professionals.length === 0) {
      console.log('No professionals need refreshing');
      return new Response(
        JSON.stringify({ success: true, updated: 0, message: 'No updates needed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${professionals.length} professionals to refresh`);

    let updated = 0;
    let errors = 0;

    // Process each professional
    for (const prof of professionals) {
      try {
        const city = (prof.cities as any).name;
        const state = (prof.cities as any).state;

        console.log(`Refreshing ${prof.name} (${city}, ${state})...`);

        const { data, error } = await supabase.functions.invoke('update-agent-zillow-stats', {
          body: {
            professionalId: prof.id,
            city,
            state
          }
        });

        if (error) {
          console.error(`Failed to refresh ${prof.name}:`, error);
          errors++;
          continue;
        }

        if (data?.success) {
          updated++;
          console.log(`✓ Refreshed ${prof.name}`);
        } else {
          console.log(`⚠ Could not find data for ${prof.name}`);
        }

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(`Error refreshing ${prof.name}:`, err);
        errors++;
      }
    }

    console.log(`Refresh complete: ${updated} updated, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        errors,
        total: professionals.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in refresh-all-agent-stats:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
