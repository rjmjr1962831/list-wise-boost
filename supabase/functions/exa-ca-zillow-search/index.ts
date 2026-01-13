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

// Normalize Zillow URL to prevent duplicates from URL variations
function normalizeZillowUrl(url: string): string {
  if (!url) return '';
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .replace(/\?.*$/, ''); // Remove query params
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      batch_size = 10, 
      delay_ms = 1000, // 1 second between each request
      dry_run = false 
    } = await req.json().catch(() => ({}));
    
    const EXA_API_KEY = Deno.env.get('EXA_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!EXA_API_KEY) {
      throw new Error('EXA_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // PRE-LOAD: Get all Zillow URLs already assigned in state_licenses to prevent duplicates
    const { data: existingZillowData } = await supabase
      .from('state_licenses')
      .select('zillow_url')
      .eq('state', 'CA')
      .not('zillow_url', 'is', null);
    
    const existingZillowUrls = new Set<string>(
      (existingZillowData || [])
        .map(r => normalizeZillowUrl(r.zillow_url))
        .filter(Boolean)
    );
    
    // Track URLs assigned in this batch to prevent duplicates within same batch
    const batchZillowUrls = new Set<string>();
    
    console.log(`Pre-loaded ${existingZillowUrls.size} existing Zillow URLs for deduplication`);

    // Get CA agents from state_licenses that haven't been processed yet
    // Use DISTINCT ON name to avoid processing duplicate names
    const { data: agents, error: fetchError } = await supabase
      .from('state_licenses')
      .select('id, name, license_number, city, brokerage_name')
      .eq('state', 'CA')
      .is('zillow_url', null)
      .is('exa_searched_at', null)
      .order('name')
      .limit(batch_size);

    if (fetchError) {
      throw new Error(`Failed to fetch agents: ${fetchError.message}`);
    }

    if (!agents || agents.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No more CA agents to process',
        processed: 0,
        remaining: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get remaining count
    const { count: remainingCount } = await supabase
      .from('state_licenses')
      .select('id', { count: 'exact', head: true })
      .eq('state', 'CA')
      .is('zillow_url', null)
      .is('exa_searched_at', null);

    console.log(`Processing ${agents.length} CA agents with ${delay_ms}ms delay between requests. ${remainingCount} remaining.`);

    const results: Array<{
      id: string;
      name: string;
      license_number: string;
      zillow_url: string | null;
      exa_score: number | null;
      status: string;
    }> = [];

    let found = 0;
    let notFound = 0;
    let errors = 0;
    let duplicates = 0;

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      
      try {
        const searchQuery = `${agent.name} real estate agent California Zillow profile`;
        
        console.log(`[${i + 1}/${agents.length}] Searching Exa for: ${agent.name}`);

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
          
          if (!dry_run) {
            await supabase.from('state_licenses').update({
              exa_searched_at: new Date().toISOString(),
              exa_search_notes: `exa_error_${exaResponse.status}`,
            }).eq('id', agent.id);
          }
          
          results.push({
            id: agent.id,
            name: agent.name,
            license_number: agent.license_number,
            zillow_url: null,
            exa_score: null,
            status: `exa_error: ${exaResponse.status}`,
          });
          errors++;
          
          // If rate limited, wait longer
          if (exaResponse.status === 429) {
            console.log('Rate limited! Waiting 5 seconds...');
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
          continue;
        }

        const exaData: ExaResponse = await exaResponse.json();
        
        const zillowProfile = exaData.results?.find(r => 
          r.url.includes('zillow.com/profile/') || 
          r.url.includes('zillow.com/agent/')
        );

        if (zillowProfile) {
          const normalizedUrl = normalizeZillowUrl(zillowProfile.url);
          
          // CHECK FOR DUPLICATE: Has this Zillow URL already been assigned?
          if (existingZillowUrls.has(normalizedUrl) || batchZillowUrls.has(normalizedUrl)) {
            console.log(`[${agent.name}] DUPLICATE Zillow URL detected, skipping: ${normalizedUrl}`);
            results.push({
              id: agent.id,
              name: agent.name,
              license_number: agent.license_number,
              zillow_url: zillowProfile.url,
              exa_score: zillowProfile.score,
              status: 'duplicate_zillow_url',
            });
            duplicates++;
            
            if (!dry_run) {
              await supabase.from('state_licenses').update({
                exa_searched_at: new Date().toISOString(),
                exa_score: zillowProfile.score,
                exa_search_notes: 'duplicate_zillow_url',
              }).eq('id', agent.id);
            }
          } else {
            // Not a duplicate - assign the URL
            batchZillowUrls.add(normalizedUrl);
            
            results.push({
              id: agent.id,
              name: agent.name,
              license_number: agent.license_number,
              zillow_url: zillowProfile.url,
              exa_score: zillowProfile.score,
              status: 'found',
            });
            found++;

            if (!dry_run) {
              await supabase.from('state_licenses').update({
                zillow_url: zillowProfile.url,
                exa_searched_at: new Date().toISOString(),
                exa_score: zillowProfile.score,
                exa_search_notes: 'zillow_found',
              }).eq('id', agent.id);
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
          notFound++;

          if (!dry_run) {
            await supabase.from('state_licenses').update({
              exa_searched_at: new Date().toISOString(),
              exa_search_notes: 'no_zillow_profile_found',
            }).eq('id', agent.id);
          }
        }

        // Delay between requests (except for the last one)
        if (i < agents.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay_ms));
        }

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
        errors++;
      }
    }

    console.log(`Batch complete: ${found} found, ${notFound} not found, ${duplicates} duplicates, ${errors} errors`);

    return new Response(JSON.stringify({
      message: `Processed ${results.length} CA agents`,
      dry_run,
      batch_size,
      delay_ms,
      remaining: (remainingCount || 0) - results.length,
      summary: { found, notFound, duplicates, errors, total: results.length },
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
