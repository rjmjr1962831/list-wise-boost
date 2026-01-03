import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExaSearchResult {
  title: string;
  url: string;
  score: number;
}

interface ExaResponse {
  results: ExaSearchResult[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batch_size = 50, offset = 0, dry_run = false } = await req.json().catch(() => ({}));
    
    const EXA_API_KEY = Deno.env.get('EXA_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!EXA_API_KEY) {
      throw new Error('EXA_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get CA agents from state_licenses that haven't been processed yet
    const { data: agents, error: fetchError } = await supabase
      .from('state_licenses')
      .select('id, name, license_number, city, brokerage_name')
      .eq('state', 'CA')
      .is('zillow_url', null) // Only unprocessed
      .order('name')
      .range(offset, offset + batch_size - 1);

    if (fetchError) {
      throw new Error(`Failed to fetch agents: ${fetchError.message}`);
    }

    if (!agents || agents.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No more CA agents to process',
        processed: 0,
        offset 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${agents.length} CA agents starting at offset ${offset}`);

    const results: Array<{
      id: string;
      name: string;
      license_number: string;
      zillow_url: string | null;
      exa_score: number | null;
      status: string;
    }> = [];

    // Process each agent with Exa search
    for (const agent of agents) {
      try {
        // Build search query for Zillow profile
        const searchQuery = `${agent.name} real estate agent California Zillow profile`;
        
        console.log(`Searching Exa for: ${agent.name}`);

        const exaResponse = await fetch('https://api.exa.ai/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${EXA_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: searchQuery,
            numResults: 3,
            type: 'neural',
            useAutoprompt: true,
            includeDomains: ['zillow.com'],
          }),
        });

        if (!exaResponse.ok) {
          const errorText = await exaResponse.text();
          console.error(`Exa API error for ${agent.name}: ${exaResponse.status} - ${errorText}`);
          results.push({
            id: agent.id,
            name: agent.name,
            license_number: agent.license_number,
            zillow_url: null,
            exa_score: null,
            status: `exa_error: ${exaResponse.status}`,
          });
          continue;
        }

        const exaData: ExaResponse = await exaResponse.json();
        
        // Find Zillow profile URL from results
        const zillowProfile = exaData.results?.find(r => 
          r.url.includes('zillow.com/profile/') || 
          r.url.includes('zillow.com/agent/')
        );

        if (zillowProfile) {
          results.push({
            id: agent.id,
            name: agent.name,
            license_number: agent.license_number,
            zillow_url: zillowProfile.url,
            exa_score: zillowProfile.score,
            status: 'found',
          });

          // Update state_licenses with Zillow URL and test notation
          if (!dry_run) {
            const { error: updateError } = await supabase
              .from('state_licenses')
              .update({
                zillow_url: zillowProfile.url,
                exa_search_notes: 'exa_search_only_test',
                exa_searched_at: new Date().toISOString(),
              })
              .eq('id', agent.id);

            if (updateError) {
              console.error(`Failed to update ${agent.name}: ${updateError.message}`);
            }
          }
        } else {
          results.push({
            id: agent.id,
            name: agent.name,
            license_number: agent.license_number,
            zillow_url: null,
            exa_score: null,
            status: 'no_zillow_profile_found',
          });

          // Mark as searched but not found
          if (!dry_run) {
            const { error: updateError } = await supabase
              .from('state_licenses')
              .update({
                exa_search_notes: 'exa_search_only_test_no_result',
                exa_searched_at: new Date().toISOString(),
              })
              .eq('id', agent.id);

            if (updateError) {
              console.error(`Failed to update ${agent.name}: ${updateError.message}`);
            }
          }
        }

        // Rate limit: 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (agentError) {
        console.error(`Error processing ${agent.name}:`, agentError);
        results.push({
          id: agent.id,
          name: agent.name,
          license_number: agent.license_number,
          zillow_url: null,
          exa_score: null,
          status: `error: ${agentError instanceof Error ? agentError.message : 'unknown'}`,
        });
      }
    }

    const found = results.filter(r => r.status === 'found').length;
    const notFound = results.filter(r => r.status === 'no_zillow_profile_found').length;
    const errors = results.filter(r => r.status.startsWith('error') || r.status.startsWith('exa_error')).length;

    console.log(`Batch complete: ${found} found, ${notFound} not found, ${errors} errors`);

    return new Response(JSON.stringify({
      message: `Processed ${results.length} CA agents`,
      dry_run,
      offset,
      next_offset: offset + batch_size,
      summary: { found, notFound, errors, total: results.length },
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
