import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { state, batchSize = 50, concurrency = 5, offset = 0, dryRun = false } = await req.json();

    if (!state) {
      return new Response(JSON.stringify({ error: 'state is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`🚀 Starting bulk Pipedrive sync for state: ${state}`);
    console.log(`📊 Settings: batchSize=${batchSize}, concurrency=${concurrency}, offset=${offset}, dryRun=${dryRun}`);

    // Get city IDs for the state
    const { data: cities, error: citiesError } = await supabase
      .from('cities')
      .select('id')
      .eq('state', state);

    if (citiesError) {
      throw new Error(`Failed to fetch cities: ${citiesError.message}`);
    }

    const cityIds = cities?.map(c => c.id) || [];
    console.log(`📍 Found ${cityIds.length} cities in ${state}`);

    if (cityIds.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No cities found for state',
        synced: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get qualified professionals for this state using a raw query approach
    // Since we can't use IN with many IDs, we'll query in chunks
    let allProfessionals: { id: string; name: string; email: string }[] = [];
    
    for (let i = 0; i < cityIds.length; i += 50) {
      const cityChunk = cityIds.slice(i, i + 50);
      
      const { data: profs, error: profError } = await supabase
        .from('professionals')
        .select('id, name, email')
        .in('city_id', cityChunk)
        .eq('active', true)
        .gte('review_stars_rating', 4.8)
        .gte('num_total_reviews', 20)
        .not('email', 'is', null);

      if (profError) {
        console.error(`Error fetching professionals for city chunk: ${profError.message}`);
        continue;
      }

      if (profs) {
        allProfessionals = allProfessionals.concat(profs);
      }
    }

    // Sort by name and apply offset/limit
    allProfessionals.sort((a, b) => a.name.localeCompare(b.name));
    const professionals = allProfessionals.slice(offset, offset + batchSize);

    console.log(`👥 Processing ${professionals.length} professionals (offset: ${offset}, total available: ${allProfessionals.length})`);

    if (professionals.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No more professionals to sync',
        synced: 0,
        offset,
        total: allProfessionals.length,
        complete: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process in parallel batches
    const results: { name: string; success: boolean; error?: string }[] = [];
    
    for (let i = 0; i < professionals.length; i += concurrency) {
      const batch = professionals.slice(i, i + concurrency);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (prof) => {
          if (dryRun) {
            console.log(`[DRY RUN] Would sync: ${prof.name}`);
            return { name: prof.name, success: true };
          }

          try {
            const { error } = await supabase.functions.invoke('sync-single-professional', {
              body: { professional_id: prof.id }
            });

            if (error) {
              console.error(`❌ Failed to sync ${prof.name}: ${error.message}`);
              return { name: prof.name, success: false, error: error.message };
            }

            console.log(`✅ Synced: ${prof.name}`);
            return { name: prof.name, success: true };
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            console.error(`❌ Exception syncing ${prof.name}: ${errorMsg}`);
            return { name: prof.name, success: false, error: errorMsg };
          }
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({ name: 'unknown', success: false, error: result.reason?.message });
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i + concurrency < professionals.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const hasMore = professionals.length === batchSize;
    const nextOffset = offset + professionals.length;

    console.log(`📊 Batch complete: ${successCount} synced, ${failCount} failed`);
    console.log(`📍 Next offset: ${nextOffset}, hasMore: ${hasMore}`);

    // Auto-continue if there are more
    if (hasMore && !dryRun) {
      console.log(`🔄 Triggering next batch at offset ${nextOffset}...`);
      
      // Fire and forget - don't await
      setTimeout(async () => {
        try {
          await supabase.functions.invoke('bulk-sync-pipedrive-state', {
            body: { state, batchSize, concurrency, offset: nextOffset, dryRun }
          });
        } catch (e) {
          console.error('Failed to trigger next batch:', e);
        }
      }, 1000);
    }

    return new Response(JSON.stringify({
      success: true,
      state,
      offset,
      processed: professionals.length,
      synced: successCount,
      failed: failCount,
      hasMore,
      nextOffset: hasMore ? nextOffset : null,
      results: results.slice(0, 10) // Only return first 10 for brevity
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Bulk sync error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
