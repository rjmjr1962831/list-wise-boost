import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 25; // Process 25 at a time to avoid timeouts

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { limit = null, sync_to_pipedrive = false, regenerate_all = false, offset = 0 } = await req.json();

    console.log(`🚀 Processing batch starting at offset ${offset}...`, { regenerate_all });

    // Fetch professionals in batches
    let query = supabase
      .from('professionals')
      .select('id, name, email, phone')
      .eq('active', true)
      .order('name')
      .range(offset, offset + BATCH_SIZE - 1);

    // Only filter by null profile_link if NOT regenerating all
    if (!regenerate_all) {
      query = query.is('profile_link', null);
    }

    const { data: professionals, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    // Get total count for progress
    let countQuery = supabase
      .from('professionals')
      .select('id', { count: 'exact', head: true })
      .eq('active', true);
    
    if (!regenerate_all) {
      countQuery = countQuery.is('profile_link', null);
    }
    
    const { count: totalCount } = await countQuery;

    console.log(`📊 Processing ${professionals?.length || 0} professionals (offset: ${offset}, total: ${totalCount})`);

    if (!professionals || professionals.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: offset === 0 ? 'No professionals need magic links' : 'Batch processing complete!',
          results: { 
            total: totalCount || 0, 
            processed: offset,
            batch_size: 0,
            has_more: false
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as any[]
    };

    // Process this batch
    for (const professional of professionals) {
      try {
        console.log(`🔗 [${offset + results.successful + results.failed + 1}/${totalCount}] Generating link for ${professional.name}`);

        const response = await fetch(`${supabaseUrl}/functions/v1/generate-magic-link`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            professional_id: professional.id,
            pipedrive_person_id: null
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

    const hasMore = professionals.length === BATCH_SIZE;
    const nextOffset = offset + professionals.length;

    console.log(`✅ Batch complete: ${results.successful} successful, ${results.failed} failed. Has more: ${hasMore}`);

    // Auto-continue to next batch if there are more
    if (hasMore) {
      console.log(`🔄 Auto-continuing to next batch at offset ${nextOffset}...`);
      
      // Fire off next batch without waiting
      fetch(`${supabaseUrl}/functions/v1/generate-all-magic-links`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          regenerate_all,
          sync_to_pipedrive,
          offset: nextOffset
        })
      }).catch(err => console.error('Failed to trigger next batch:', err));
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: hasMore 
          ? `Processed batch ${Math.floor(offset / BATCH_SIZE) + 1}, continuing...` 
          : 'All batches complete!',
        results: {
          total: totalCount,
          processed: nextOffset,
          batch_successful: results.successful,
          batch_failed: results.failed,
          has_more: hasMore,
          errors: results.errors
        }
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
