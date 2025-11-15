import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { professionalId, city, state } = await req.json();
    
    if (!professionalId || !city || !state) {
      throw new Error('Missing required parameters: professionalId, city, state');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the professional record
    const { data: professional, error: profError } = await supabase
      .from('professionals')
      .select('name, zillow_profile_url, zuid, image_url')
      .eq('id', professionalId)
      .single();

    if (profError || !professional) {
      throw new Error(`Professional not found: ${profError?.message}`);
    }

    console.log(`Fetching Zillow stats for ${professional.name}...`);

    // Fetch agents from Zillow
    const { data: zillowAgents, error: zillowError } = await supabase.functions.invoke('fetch-zillow-agents', {
      body: { city, state }
    });

    if (zillowError) {
      throw new Error(`Failed to fetch Zillow agents: ${zillowError.message}`);
    }

    if (!Array.isArray(zillowAgents) || zillowAgents.length === 0) {
      console.log('No Zillow agents found for this location');
      return new Response(
        JSON.stringify({ success: false, message: 'No agents found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find matching agent by name
    const matchingAgent = zillowAgents.find((agent: any) => {
      const agentName = (agent.name || '').toLowerCase().trim();
      const profName = professional.name.toLowerCase().trim();
      
      // Try exact match first
      if (agentName === profName) return true;
      
      // Try partial match (handle team names, etc.)
      const profParts = profName.split(/\s+/);
      const agentParts = agentName.split(/\s+/);
      
      // If both parts overlap significantly, consider it a match
      const overlap = profParts.filter((p: string) => agentParts.some((a: string) => a.includes(p) || p.includes(a)));
      return overlap.length >= Math.min(2, profParts.length);
    });

    if (!matchingAgent) {
      console.log(`No matching agent found for ${professional.name}`);
      return new Response(
        JSON.stringify({ success: false, message: 'Agent not found in Zillow results' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Matched agent:', matchingAgent.name);

    // Parse Zillow data
    const updates: any = {
      zillow_data_fetched_at: new Date().toISOString(),
    };

    // Extract profile URL
    if (matchingAgent.profile_url) {
      updates.zillow_profile_url = matchingAgent.profile_url;
    }

    // Extract ZUID (Zillow unique ID) from profile URL
    if (matchingAgent.profile_url && !professional.zuid) {
      const zuidMatch = matchingAgent.profile_url.match(/\/profile\/([^/]+)/);
      if (zuidMatch) {
        updates.zuid = zuidMatch[1];
      }
    }

    // Extract sales data (prioritize team_sales_last_12_months)
    if (matchingAgent.team_sales_last_12_months) {
      const salesCount = parseInt(matchingAgent.team_sales_last_12_months);
      if (!isNaN(salesCount)) {
        updates.total_sales = salesCount;
      }
    }

    // Extract image URL
    if (matchingAgent.image_url && !professional.image_url) {
      updates.image_url = matchingAgent.image_url;
    }

    // Extract company
    if (matchingAgent.company) {
      updates.company = matchingAgent.company;
    }

    // Parse price range to estimate current listings
    if (matchingAgent.price_range && !updates.current_listings) {
      // Price range like "$11K - $3.5M" suggests active listings
      updates.current_listings = Math.max(1, Math.floor((updates.total_sales || 10) / 20));
    }

    console.log('Updating professional with:', updates);

    // Update the professional record
    const { error: updateError } = await supabase
      .from('professionals')
      .update(updates)
      .eq('id', professionalId);

    if (updateError) {
      throw new Error(`Failed to update professional: ${updateError.message}`);
    }

    console.log(`✓ Successfully updated ${professional.name}`);

    return new Response(
      JSON.stringify({
        success: true,
        updates,
        agentName: matchingAgent.name
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in update-agent-zillow-stats:', error);
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
