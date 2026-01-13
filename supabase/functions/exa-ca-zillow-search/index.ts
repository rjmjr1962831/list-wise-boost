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

interface AgentGroup {
  name: string;
  count: number;
  ids: string[];
  license_numbers: string[];
  cities: string[];
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
      delay_ms = 1000,
      dry_run = false 
    } = await req.json().catch(() => ({}));
    
    const EXA_API_KEY = Deno.env.get('EXA_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!EXA_API_KEY) {
      throw new Error('EXA_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // PRE-LOAD: Get all Zillow URLs already assigned to prevent duplicates
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
    
    const batchZillowUrls = new Set<string>();
    
    console.log(`Pre-loaded ${existingZillowUrls.size} existing Zillow URLs for deduplication`);

    // STEP 1: Get UNIQUE names that haven't been processed, grouped with counts
    // This is the key optimization - we query names, not individual records
    const { data: unprocessedAgents, error: fetchError } = await supabase
      .from('state_licenses')
      .select('id, name, license_number, city')
      .eq('state', 'CA')
      .is('zillow_url', null)
      .is('exa_searched_at', null)
      .order('name')
      .limit(1000); // Get more to group properly

    if (fetchError) {
      throw new Error(`Failed to fetch agents: ${fetchError.message}`);
    }

    if (!unprocessedAgents || unprocessedAgents.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No more CA agents to process',
        processed: 0,
        remaining: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // STEP 2: Group agents by name to find duplicates
    const nameGroups = new Map<string, AgentGroup>();
    for (const agent of unprocessedAgents) {
      const existing = nameGroups.get(agent.name);
      if (existing) {
        existing.count++;
        existing.ids.push(agent.id);
        existing.license_numbers.push(agent.license_number);
        existing.cities.push(agent.city || 'unknown');
      } else {
        nameGroups.set(agent.name, {
          name: agent.name,
          count: 1,
          ids: [agent.id],
          license_numbers: [agent.license_number],
          cities: [agent.city || 'unknown'],
        });
      }
    }

    // STEP 3: Separate unique names from duplicate names
    const uniqueNames: AgentGroup[] = [];
    const duplicateNames: AgentGroup[] = [];
    
    for (const group of nameGroups.values()) {
      if (group.count === 1) {
        uniqueNames.push(group);
      } else {
        duplicateNames.push(group);
      }
    }

    console.log(`Found ${uniqueNames.length} unique names, ${duplicateNames.length} duplicate name groups (${duplicateNames.reduce((sum, g) => sum + g.count, 0)} agents)`);

    // STEP 4: Mark all duplicate-name agents as ambiguous (DON'T call Exa for them)
    let ambiguousMarked = 0;
    if (!dry_run && duplicateNames.length > 0) {
      for (const group of duplicateNames) {
        const { error: updateError } = await supabase
          .from('state_licenses')
          .update({
            exa_searched_at: new Date().toISOString(),
            exa_search_notes: `ambiguous_name_${group.count}_matches`,
          })
          .in('id', group.ids);
        
        if (!updateError) {
          ambiguousMarked += group.count;
        }
      }
      console.log(`Marked ${ambiguousMarked} agents as ambiguous (shared name with others)`);
    }

    // STEP 5: Process only UNIQUE names (one Exa call per unique name)
    const namesToProcess = uniqueNames.slice(0, batch_size);
    
    const results: Array<{
      name: string;
      license_number: string;
      zillow_url: string | null;
      exa_score: number | null;
      status: string;
    }> = [];

    let found = 0;
    let notFound = 0;
    let errors = 0;
    let duplicateUrls = 0;

    for (let i = 0; i < namesToProcess.length; i++) {
      const group = namesToProcess[i];
      const agentId = group.ids[0];
      const licenseNumber = group.license_numbers[0];
      
      try {
        const searchQuery = `${group.name} real estate agent California Zillow profile`;
        
        console.log(`[${i + 1}/${namesToProcess.length}] Searching Exa for: ${group.name}`);

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
          console.error(`Exa API error for ${group.name}: ${exaResponse.status} - ${errorText}`);
          
          if (!dry_run) {
            await supabase.from('state_licenses').update({
              exa_searched_at: new Date().toISOString(),
              exa_search_notes: `exa_error_${exaResponse.status}`,
            }).eq('id', agentId);
          }
          
          results.push({
            name: group.name,
            license_number: licenseNumber,
            zillow_url: null,
            exa_score: null,
            status: `exa_error: ${exaResponse.status}`,
          });
          errors++;
          
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
          
          // Check if this URL is already assigned to another agent
          if (existingZillowUrls.has(normalizedUrl) || batchZillowUrls.has(normalizedUrl)) {
            console.log(`[${group.name}] Zillow URL already assigned elsewhere: ${normalizedUrl}`);
            results.push({
              name: group.name,
              license_number: licenseNumber,
              zillow_url: zillowProfile.url,
              exa_score: zillowProfile.score,
              status: 'duplicate_zillow_url',
            });
            duplicateUrls++;
            
            if (!dry_run) {
              await supabase.from('state_licenses').update({
                exa_searched_at: new Date().toISOString(),
                exa_score: zillowProfile.score,
                exa_search_notes: 'duplicate_zillow_url',
              }).eq('id', agentId);
            }
          } else {
            // Success - unique name with unique Zillow URL
            batchZillowUrls.add(normalizedUrl);
            
            results.push({
              name: group.name,
              license_number: licenseNumber,
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
              }).eq('id', agentId);
            }
          }
        } else {
          results.push({
            name: group.name,
            license_number: licenseNumber,
            zillow_url: null,
            exa_score: null,
            status: 'no_zillow_profile_found',
          });
          notFound++;

          if (!dry_run) {
            await supabase.from('state_licenses').update({
              exa_searched_at: new Date().toISOString(),
              exa_search_notes: 'no_zillow_profile_found',
            }).eq('id', agentId);
          }
        }

        // Delay between requests
        if (i < namesToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay_ms));
        }

      } catch (agentError) {
        console.error(`Error processing ${group.name}:`, agentError);
        results.push({
          name: group.name,
          license_number: licenseNumber,
          zillow_url: null,
          exa_score: null,
          status: `error: ${agentError instanceof Error ? agentError.message : 'unknown'}`,
        });
        errors++;
      }
    }

    // Get remaining count of unprocessed unique names
    const remainingUnique = uniqueNames.length - namesToProcess.length;

    console.log(`Batch complete: ${found} found, ${notFound} not found, ${duplicateUrls} dup URLs, ${errors} errors, ${ambiguousMarked} ambiguous`);

    return new Response(JSON.stringify({
      message: `Processed ${results.length} unique names, marked ${ambiguousMarked} ambiguous`,
      dry_run,
      batch_size,
      delay_ms,
      stats: {
        total_unprocessed_agents: unprocessedAgents.length,
        unique_names: uniqueNames.length,
        duplicate_name_groups: duplicateNames.length,
        duplicate_name_agents: duplicateNames.reduce((sum, g) => sum + g.count, 0),
        ambiguous_marked: ambiguousMarked,
      },
      summary: { 
        exa_calls_made: namesToProcess.length,
        found, 
        notFound, 
        duplicateUrls,
        errors, 
        remaining_unique: remainingUnique 
      },
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
