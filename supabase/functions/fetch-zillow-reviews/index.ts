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
    const { zuid, pageNumber = 1, pageSize = 10 } = await req.json();
    
    if (!zuid) {
      throw new Error('ZUID is required');
    }

    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN')?.trim();

    if (!APIFY_API_TOKEN) {
      const error = 'Apify API token not configured';
      await sendFailureAlert('fetch-zillow-reviews', error, { zuid, pageNumber, pageSize });
      throw new Error(error);
    }

    console.log(`Fetching reviews for ZUID: ${zuid} using Apify`);

    // Use the Apify Zillow Reviews scraper
    const actorId = 'apify~zillow-reviews-scraper';
    const apifyInput = {
      agentScreenNames: [zuid],
      proxy: {
        useApifyProxy: true,
        apifyProxyGroups: ["RESIDENTIAL"],
        apifyProxyCountry: "US"
      }
    };

    console.log('Starting Apify reviews scraper');

    const startResp = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apifyInput),
    });

    if (!startResp.ok) {
      const errorText = await startResp.text();
      console.error('Apify start error:', startResp.status, errorText);
      await sendFailureAlert('fetch-zillow-reviews', `Apify API start failed: ${startResp.status}`, {
        zuid,
        error: errorText
      });
      throw new Error(`Apify API request failed: ${startResp.status}`);
    }

    const run = await startResp.json();
    const runId = run.data.id;
    console.log('Apify run started:', runId);

    // Poll for completion (max ~15s)
    let status = run.data.status;
    let attempts = 0;
    while (status !== 'SUCCEEDED' && status !== 'FAILED' && attempts < 15) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const statusResp = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${APIFY_API_TOKEN}`);
      if (!statusResp.ok) break;
      const statusData = await statusResp.json();
      status = statusData.data.status;
      console.log(`Apify reviews run status: ${status} (attempt ${attempts + 1})`);
      attempts++;
    }

    if (status !== 'SUCCEEDED') {
      const error = `Apify reviews run did not succeed: ${status}`;
      console.error(error);
      await sendFailureAlert('fetch-zillow-reviews', error, { zuid, runId, attempts });
      throw new Error(error);
    }

    const datasetId = run.data.defaultDatasetId;
    const dataResp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`);
    
    if (!dataResp.ok) {
      const error = 'Failed to fetch Apify reviews dataset';
      await sendFailureAlert('fetch-zillow-reviews', error, { zuid, datasetId });
      throw new Error(error);
    }

    const allReviews = await dataResp.json();
    console.log(`Fetched ${allReviews.length} reviews from Apify`);

    const result = {
      reviews: allReviews.slice(0, pageSize),
      totalReviews: allReviews.length,
      averageRating: allReviews.length > 0 
        ? allReviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / allReviews.length 
        : 0
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-zillow-reviews function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
