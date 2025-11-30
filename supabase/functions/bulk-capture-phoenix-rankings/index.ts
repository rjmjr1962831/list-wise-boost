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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Check if this is a WebSocket upgrade request
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    socket.onopen = async () => {
      console.log('WebSocket connection opened');
      
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        console.log('🚀 Starting bulk Phoenix metro ranking capture');
        socket.send(JSON.stringify({
          type: 'started',
          totalCities: PHOENIX_METRO_CITIES.length
        }));

        const results = [];
        let totalUpdated = 0;
        let totalNotFound = 0;
        let totalFailed = 0;

        for (let i = 0; i < PHOENIX_METRO_CITIES.length; i++) {
          const cityName = PHOENIX_METRO_CITIES[i];
          console.log(`\n[${i + 1}/${PHOENIX_METRO_CITIES.length}] Processing ${cityName}...`);
          
          // Send progress update
          socket.send(JSON.stringify({
            type: 'progress',
            current: i + 1,
            total: PHOENIX_METRO_CITIES.length,
            currentCity: cityName,
            status: 'processing'
          }));

          try {
            const { data, error } = await supabase.functions.invoke('capture-zillow-rankings', {
              body: { cityName }
            });

            if (error) {
              console.error(`❌ Failed to capture ${cityName}:`, error);
              results.push({
                city: cityName,
                status: 'failed',
                error: error.message
              });
              totalFailed++;
              
              socket.send(JSON.stringify({
                type: 'city_complete',
                city: cityName,
                status: 'failed',
                error: error.message
              }));
            } else {
              console.log(`✅ Completed ${cityName}: ${data.stats.updated} updated, ${data.stats.notFound} not found`);
              results.push({
                city: cityName,
                status: 'success',
                updated: data.stats.updated,
                notFound: data.stats.notFound,
                totalFound: data.stats.totalFound
              });
              totalUpdated += data.stats.updated;
              totalNotFound += data.stats.notFound;
              
              socket.send(JSON.stringify({
                type: 'city_complete',
                city: cityName,
                status: 'success',
                updated: data.stats.updated,
                notFound: data.stats.notFound
              }));
            }

            // Add delay between cities
            if (i < PHOENIX_METRO_CITIES.length - 1) {
              console.log('⏱️ Waiting 10 seconds before next city...');
              await new Promise(resolve => setTimeout(resolve, 10000));
            }

          } catch (error) {
            console.error(`❌ Exception processing ${cityName}:`, error);
            results.push({
              city: cityName,
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            totalFailed++;
            
            socket.send(JSON.stringify({
              type: 'city_complete',
              city: cityName,
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error'
            }));
          }
        }

        console.log('\n✅ Bulk capture complete!');
        
        // Send completion message
        socket.send(JSON.stringify({
          type: 'complete',
          summary: {
            totalCities: PHOENIX_METRO_CITIES.length,
            totalUpdated,
            totalNotFound,
            totalFailed
          },
          results
        }));

      } catch (error) {
        console.error('Error in bulk capture:', error);
        socket.send(JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
      }
    };

    socket.onerror = (e) => console.error('WebSocket error:', e);
    socket.onclose = () => console.log('WebSocket connection closed');

    return response;
  }

  // Fallback to regular HTTP request
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 Starting bulk Phoenix metro ranking capture');
    console.log(`📍 Processing ${PHOENIX_METRO_CITIES.length} cities`);

    const results = [];
    let totalUpdated = 0;
    let totalNotFound = 0;
    let totalFailed = 0;

    for (let i = 0; i < PHOENIX_METRO_CITIES.length; i++) {
      const cityName = PHOENIX_METRO_CITIES[i];
      console.log(`\n[${i + 1}/${PHOENIX_METRO_CITIES.length}] Processing ${cityName}...`);

      try {
        // Call the single city capture function
        const { data, error } = await supabase.functions.invoke('capture-zillow-rankings', {
          body: { cityName }
        });

        if (error) {
          console.error(`❌ Failed to capture ${cityName}:`, error);
          results.push({
            city: cityName,
            status: 'failed',
            error: error.message
          });
          totalFailed++;
        } else {
          console.log(`✅ Completed ${cityName}: ${data.stats.updated} updated, ${data.stats.notFound} not found`);
          results.push({
            city: cityName,
            status: 'success',
            updated: data.stats.updated,
            notFound: data.stats.notFound,
            totalFound: data.stats.totalFound
          });
          totalUpdated += data.stats.updated;
          totalNotFound += data.stats.notFound;
        }

        // Add delay between cities to avoid rate limiting
        if (i < PHOENIX_METRO_CITIES.length - 1) {
          console.log('⏱️ Waiting 10 seconds before next city...');
          await new Promise(resolve => setTimeout(resolve, 10000));
        }

      } catch (error) {
        console.error(`❌ Exception processing ${cityName}:`, error);
        results.push({
          city: cityName,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        totalFailed++;
      }
    }

    console.log('\n✅ Bulk capture complete!');
    console.log(`📊 Summary: ${totalUpdated} updated, ${totalNotFound} not found, ${totalFailed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Bulk Phoenix metro ranking capture complete',
        summary: {
          totalCities: PHOENIX_METRO_CITIES.length,
          totalUpdated,
          totalNotFound,
          totalFailed
        },
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in bulk-capture-phoenix-rankings:', error);
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
});