import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { limit = null, sync_to_pipedrive = false } = await req.json();

    console.log('🚀 Starting batch magic link generation...');

    // Fetch all active professionals without profile_link
    let query = supabase
      .from('professionals')
      .select('id, name, email, pipedrive_person_id')
      .eq('active', true)
      .is('profile_link', null);

    if (limit) {
      query = query.limit(limit);
    }

    const { data: professionals, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    console.log(`📊 Found ${professionals?.length || 0} professionals without profile links`);

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
          message: 'No professionals need magic links',
          results
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate magic links with rate limiting (500ms between calls)
    for (const professional of professionals) {
      try {
        console.log(`🔗 [${results.successful + results.failed + 1}/${results.total}] Generating link for ${professional.name}`);

        const response = await fetch(`${supabaseUrl}/functions/v1/generate-magic-link`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            professional_id: professional.id,
            pipedrive_person_id: sync_to_pipedrive ? professional.pipedrive_person_id : null
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to generate link: ${errorText}`);
        }

        const result = await response.json();
        
        if (result.success) {
          results.successful++;
          console.log(`✅ Generated for ${professional.name}`);
        } else {
          results.failed++;
          results.errors.push({
            professional_id: professional.id,
            name: professional.name,
            error: result.error
          });
        }

        // Rate limit: 500ms between calls
        if (results.successful + results.failed < results.total) {
          await delay(500);
        }

      } catch (error: any) {
        results.failed++;
        results.errors.push({
          professional_id: professional.id,
          name: professional.name,
          error: error.message
        });
        console.error(`❌ Failed for ${professional.name}:`, error.message);
      }
    }

    console.log(`✅ Batch complete: ${results.successful} successful, ${results.failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Generated ${results.successful} magic links`,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in batch generation:', error);
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
