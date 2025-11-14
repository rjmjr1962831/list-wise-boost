import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendFailureAlert(functionName: string, error: string, context?: any) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Cannot send alert: Supabase credentials missing');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase.functions.invoke('send-api-failure-alert', {
      body: {
        functionName,
        error,
        context,
        timestamp: new Date().toISOString()
      }
    });
  } catch (e) {
    console.error('Failed to send alert email:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city, state } = await req.json();
    const apiToken = Deno.env.get('APIFY_API_KEY')?.trim() || Deno.env.get('APIFY_API_TOKEN')?.trim();

    if (!apiToken) {
      const error = 'Apify API key/token not configured';
      await sendFailureAlert('fetch-zillow-agents', error, { city, state });
      throw new Error(error);
    }

    const location = `${city}, ${state}`;
    console.log(`Fetching agents for ${location} using Apify`);

    const rawActorId = Deno.env.get('APIFY_ACTOR_ID')?.trim() || 'scraped~zillow-agent-scraper';
    
    // Normalize actor ID to support both "/" and "~" formats
    const actorId = rawActorId.includes('/') ? rawActorId.replace('/', '~') : rawActorId;
    
    // jupri/zillow-agents expects different input format
    const apifyInput = {
      query: [],
      limit: 15,
      filters: { location }
    };

    console.log('Starting Apify run with input:', JSON.stringify(apifyInput));

    const startResp = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apifyInput),
    });

    if (!startResp.ok) {
      const errorText = await startResp.text();
      console.error('Apify start error:', startResp.status, errorText);
      await sendFailureAlert('fetch-zillow-agents', `Apify API start failed: ${startResp.status}`, { 
        city, 
        state, 
        error: errorText 
      });
      throw new Error(`Apify API request failed: ${startResp.status}`);
    }

    const run = await startResp.json();
    const runId = run.data.id;
    console.log('Apify run started:', runId);

    // Poll for completion (max 60s)
    let status = run.data.status;
    let attempts = 0;
    while (status !== 'SUCCEEDED' && status !== 'FAILED' && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusResp = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${apiToken}`);
      if (!statusResp.ok) {
        console.warn('Failed to check Apify run status');
        break;
      }
      const statusData = await statusResp.json();
      status = statusData.data.status;
      console.log(`Apify run status: ${status} (attempt ${attempts + 1})`);
      attempts++;
    }

    if (status !== 'SUCCEEDED') {
      const error = `Apify run did not succeed: ${status}`;
      console.error(error);
      await sendFailureAlert('fetch-zillow-agents', error, { city, state, runId, attempts });
      throw new Error(error);
    }

    const datasetId = run.data.defaultDatasetId;
    const dataResp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}`);
    
    if (!dataResp.ok) {
      const error = 'Failed to fetch Apify dataset';
      console.error(error);
      await sendFailureAlert('fetch-zillow-agents', error, { city, state, datasetId });
      throw new Error(error);
    }

    const agents = await dataResp.json();
    console.log(`Successfully fetched ${agents.length} agents from Apify`);

    // Log first agent with all fields to help debug stats extraction
    if (agents.length > 0) {
      const firstAgent = agents[0];
      console.log('=== First agent detailed fields ===');
      console.log('Name:', firstAgent['Business Name'] || firstAgent.name);
      console.log('Reviews:', firstAgent['Review Count'] || firstAgent.reviews);
      console.log('Phone:', firstAgent['Phone Number'] || firstAgent.phone);
      console.log('Address:', firstAgent['Address'] || firstAgent.address);
      console.log('All agent keys:', Object.keys(firstAgent));
      console.log('Full agent object:', JSON.stringify(firstAgent, null, 2));
    }

    return new Response(JSON.stringify(agents), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-zillow-agents function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
