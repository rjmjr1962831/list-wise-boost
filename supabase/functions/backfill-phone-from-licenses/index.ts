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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { limit = 10, dryRun = true } = await req.json().catch(() => ({}));

    console.log(`[Backfill Phone] Starting with limit=${limit}, dryRun=${dryRun}`);

    // Get Arizona professionals - join with cities to filter by state
    const { data: professionals, error: fetchError } = await supabase
      .from('professionals')
      .select(`
        id,
        name,
        phone,
        license_number,
        city_id,
        cities!inner(state_slug)
      `)
      .eq('cities.state_slug', 'arizona')
      .eq('active', true)
      .limit(limit);

    if (fetchError) {
      console.error('[Backfill Phone] Error fetching professionals:', fetchError);
      throw fetchError;
    }

    console.log(`[Backfill Phone] Found ${professionals?.length || 0} Arizona professionals`);

    const results = {
      total: professionals?.length || 0,
      updated: 0,
      skipped: 0,
      notFound: 0,
      errors: 0,
      details: [] as any[]
    };

    for (const prof of professionals || []) {
      try {
        let licenseMatch = null;

        // First try to match by license number if available
        if (prof.license_number && prof.license_number !== 'N/A') {
          const { data: byLicense } = await supabase
            .from('arizona_licenses')
            .select('license_number, first_name, last_name, employer_phone')
            .eq('license_number', prof.license_number)
            .maybeSingle();

          if (byLicense) {
            licenseMatch = byLicense;
            console.log(`[Backfill Phone] Found license match for ${prof.name}: ${byLicense.employer_phone}`);
          }
        }

        // If no license match, try name matching
        if (!licenseMatch) {
          const nameParts = prof.name.trim().split(/\s+/);
          const firstName = nameParts[0];
          const lastName = nameParts[nameParts.length - 1];

          // Try exact name match
          const { data: byName } = await supabase
            .from('arizona_licenses')
            .select('license_number, first_name, last_name, employer_phone')
            .ilike('first_name', firstName)
            .ilike('last_name', lastName)
            .limit(1)
            .maybeSingle();

          if (byName) {
            licenseMatch = byName;
            console.log(`[Backfill Phone] Found name match for ${prof.name}: ${byName.employer_phone}`);
          }
        }

        if (!licenseMatch || !licenseMatch.employer_phone) {
          results.notFound++;
          results.details.push({
            id: prof.id,
            name: prof.name,
            status: 'not_found',
            reason: licenseMatch ? 'No employer_phone in license' : 'No license match found'
          });
          continue;
        }

        // Skip if phone is the same
        if (prof.phone === licenseMatch.employer_phone) {
          results.skipped++;
          results.details.push({
            id: prof.id,
            name: prof.name,
            status: 'skipped',
            reason: 'Phone already matches'
          });
          continue;
        }

        // Update the phone number
        if (!dryRun) {
          const { error: updateError } = await supabase
            .from('professionals')
            .update({ 
              phone: licenseMatch.employer_phone,
              updated_at: new Date().toISOString()
            })
            .eq('id', prof.id);

          if (updateError) {
            console.error(`[Backfill Phone] Error updating ${prof.name}:`, updateError);
            results.errors++;
            results.details.push({
              id: prof.id,
              name: prof.name,
              status: 'error',
              error: updateError.message
            });
            continue;
          }
        }

        results.updated++;
        results.details.push({
          id: prof.id,
          name: prof.name,
          status: dryRun ? 'would_update' : 'updated',
          oldPhone: prof.phone || '(none)',
          newPhone: licenseMatch.employer_phone
        });

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[Backfill Phone] Error processing ${prof.name}:`, err);
        results.errors++;
        results.details.push({
          id: prof.id,
          name: prof.name,
          status: 'error',
          error: errorMessage
        });
      }
    }

    console.log(`[Backfill Phone] Complete: ${results.updated} updated, ${results.skipped} skipped, ${results.notFound} not found, ${results.errors} errors`);

    return new Response(JSON.stringify({
      success: true,
      dryRun,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Backfill Phone] Fatal error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
