import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PHOENIX_METRO_CITIES = [
  "Phoenix, AZ",
  "Scottsdale, AZ",
  "Gilbert, AZ",
  "Mesa, AZ",
  "Chandler, AZ",
  "Tempe, AZ",
  "Glendale, AZ",
  "Peoria, AZ",
  "Surprise, AZ",
  "Avondale, AZ",
  "Goodyear, AZ",
  "Buckeye, AZ",
  "Queen Creek, AZ",
  "Fountain Hills, AZ",
  "Paradise Valley, AZ",
  "Cave Creek, AZ",
  "Anthem, AZ"
];

// Process cities in background
async function processCitiesInBackground(sessionId: string, supabase: any) {
  console.log(`🚀 Starting background processing for session ${sessionId}`);
  
  const results: any[] = [];
  
  for (let i = 0; i < PHOENIX_METRO_CITIES.length; i++) {
    const cityName = PHOENIX_METRO_CITIES[i];
    console.log(`\n[${i + 1}/${PHOENIX_METRO_CITIES.length}] Processing ${cityName}...`);
    
    // Update progress
    await supabase
      .from('bulk_capture_progress')
      .update({
        current_city: cityName,
        current_index: i,
        status: 'running'
      })
      .eq('session_id', sessionId);

    try {
      const { data, error } = await supabase.functions.invoke('capture-zillow-rankings', {
        body: { cityName }
      });

      const cityResult = {
        city: cityName,
        status: error ? 'failed' : 'success',
        updated: data?.stats?.updated || 0,
        notFound: data?.stats?.notFound || 0,
        error: error?.message || null,
        timestamp: new Date().toISOString()
      };

      results.push(cityResult);

      // Update results in database
      await supabase
        .from('bulk_capture_progress')
        .update({
          results: results
        })
        .eq('session_id', sessionId);

      console.log(`✅ ${cityName}: ${cityResult.status}`);

      // Reduced delay from 10s to 5s to avoid timeouts
      if (i < PHOENIX_METRO_CITIES.length - 1) {
        console.log('⏱️ Waiting 5 seconds before next city...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

    } catch (error) {
      console.error(`❌ Exception processing ${cityName}:`, error);
      const cityResult = {
        city: cityName,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      results.push(cityResult);
      
      await supabase
        .from('bulk_capture_progress')
        .update({
          results: results
        })
        .eq('session_id', sessionId);
    }
  }

  // Mark as completed
  await supabase
    .from('bulk_capture_progress')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('session_id', sessionId);

  console.log(`✅ Background processing complete for session ${sessionId}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // GET request - check progress for a session
  if (req.method === 'GET') {
    const sessionId = url.searchParams.get('sessionId');
    
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing sessionId parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const { data, error } = await supabase
        .from('bulk_capture_progress')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Error fetching progress:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch progress' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // POST request - start bulk capture
  if (req.method === 'POST') {
    try {
      // Generate unique session ID
      const sessionId = crypto.randomUUID();
      
      console.log(`🚀 Starting bulk capture with session ${sessionId}`);
      
      // Create progress record
      const { error: insertError } = await supabase
        .from('bulk_capture_progress')
        .insert({
          session_id: sessionId,
          status: 'running',
          total_cities: PHOENIX_METRO_CITIES.length,
          current_index: 0,
          results: []
        });

      if (insertError) {
        console.error('Failed to create progress record:', insertError);
        throw insertError;
      }

      // Start background processing (don't await - let it run in background)
      processCitiesInBackground(sessionId, supabase).catch(err => {
        console.error('Background processing error:', err);
        supabase
          .from('bulk_capture_progress')
          .update({
            status: 'failed',
            error_message: err.message,
            completed_at: new Date().toISOString()
          })
          .eq('session_id', sessionId);
      });

      // Return immediately with session ID
      return new Response(
        JSON.stringify({
          success: true,
          sessionId,
          message: 'Bulk capture started',
          totalCities: PHOENIX_METRO_CITIES.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      console.error('Error starting bulk capture:', error);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});