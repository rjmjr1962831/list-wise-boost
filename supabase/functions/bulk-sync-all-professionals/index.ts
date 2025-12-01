import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 Starting bulk professional sync to Pipedrive...');

    // Fetch all active professionals with email addresses
    const { data: professionals, error: fetchError } = await supabase
      .from('professionals')
      .select('id, name, email')
      .eq('active', true)
      .not('email', 'is', null);

    if (fetchError) throw fetchError;

    console.log(`📊 Found ${professionals?.length || 0} active professionals with email addresses`);

    const results = {
      total: professionals?.length || 0,
      successful: 0,
      failed: 0,
      errors: [] as any[]
    };

    if (!professionals || professionals.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No professionals to sync',
          results
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sync each professional with rate limiting (1 second between calls)
    for (const professional of professionals) {
      try {
        console.log(`🔄 [${results.successful + results.failed + 1}/${results.total}] Syncing ${professional.name}`);

        const response = await fetch(`${supabaseUrl}/functions/v1/sync-single-professional`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            professional_id: professional.id
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to sync: ${errorText}`);
        }

        const result = await response.json();
        
        if (result.success) {
          results.successful++;
          console.log(`✅ Synced ${professional.name} (${result.action})`);
        } else {
          results.failed++;
          results.errors.push({
            professional_id: professional.id,
            name: professional.name,
            email: professional.email,
            error: result.error
          });
          console.error(`❌ Failed ${professional.name}:`, result.error);
        }

        // Rate limit: 1 second between calls to avoid hitting Pipedrive API limits
        if (results.successful + results.failed < results.total) {
          await delay(1000);
        }

      } catch (error: any) {
        results.failed++;
        results.errors.push({
          professional_id: professional.id,
          name: professional.name,
          email: professional.email,
          error: error.message
        });
        console.error(`❌ Failed for ${professional.name}:`, error.message);
      }
    }

    console.log(`✅ Bulk sync complete: ${results.successful} successful, ${results.failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${results.successful}/${results.total} professionals to Pipedrive`,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in bulk sync:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
