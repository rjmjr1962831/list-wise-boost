import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const pipedriveApiToken = Deno.env.get('PIPEDRIVE_API_TOKEN');
    const pipedriveDomain = Deno.env.get('PIPEDRIVE_DOMAIN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!pipedriveApiToken || !pipedriveDomain) {
      throw new Error('Pipedrive credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 50;
    const dryRun = body.dryRun === true;
    const activeStatusValue = body.activeStatusValue || 'Active';

    // Active Status field key from Pipedrive
    const ACTIVE_STATUS_FIELD_KEY = '21cca3b7a2edc39a9a81e18ee9daac3b958ca3cf';

    console.log(`🔄 Bulk updating Pipedrive active_status to "${activeStatusValue}" (limit: ${limit}, dryRun: ${dryRun})`);

    // Get all active professionals with pipedrive_person_id
    const { data: syncStates, error: syncError } = await supabase
      .from('pipedrive_sync_state')
      .select(`
        pipedrive_person_id,
        professional_id,
        professionals!inner(id, name, active)
      `)
      .not('pipedrive_person_id', 'is', null)
      .eq('professionals.active', true)
      .limit(limit);

    if (syncError) {
      throw new Error(`Failed to fetch sync states: ${syncError.message}`);
    }

    console.log(`📋 Found ${syncStates?.length || 0} active agents with Pipedrive IDs`);

    const results = {
      total: syncStates?.length || 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    if (dryRun) {
      console.log('🧪 DRY RUN - would update these agents:');
      for (const state of syncStates || []) {
        const prof = state.professionals as any;
        console.log(`  - ${prof.name} (Pipedrive ID: ${state.pipedrive_person_id})`);
      }
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          results,
          message: `Would update ${results.total} agents`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update each person in Pipedrive
    for (const state of syncStates || []) {
      const prof = state.professionals as any;
      const personId = state.pipedrive_person_id;

      try {
        // First check if already set to Active
        const checkResponse = await fetch(
          `https://${pipedriveDomain}.pipedrive.com/api/v1/persons/${personId}?api_token=${pipedriveApiToken}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );

        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          const currentValue = checkData.data?.[ACTIVE_STATUS_FIELD_KEY];
          if (currentValue === activeStatusValue) {
            console.log(`⏭️ Skipping ${prof.name} - already Active`);
            results.skipped++;
            continue;
          }
        }

        console.log(`📝 Updating ${prof.name} (Pipedrive ID: ${personId})...`);

        const updateResponse = await fetch(
          `https://${pipedriveDomain}.pipedrive.com/api/v1/persons/${personId}?api_token=${pipedriveApiToken}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              [ACTIVE_STATUS_FIELD_KEY]: activeStatusValue,
            }),
          }
        );

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          console.error(`❌ Failed to update ${prof.name}: ${errorText}`);
          results.errors.push(`${prof.name}: ${errorText}`);
          continue;
        }

        const updateData = await updateResponse.json();
        if (updateData.success) {
          console.log(`✅ Updated ${prof.name} to active_status = "${activeStatusValue}"`);
          results.updated++;
        } else {
          console.error(`❌ API returned failure for ${prof.name}`);
          results.errors.push(`${prof.name}: API returned failure`);
        }

        // Rate limiting - 100ms between requests
        await delay(100);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Error updating ${prof.name}: ${errorMsg}`);
        results.errors.push(`${prof.name}: ${errorMsg}`);
      }
    }

    console.log(`✅ Bulk update complete: ${results.updated} updated, ${results.skipped} skipped, ${results.errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: `Updated ${results.updated}/${results.total} agents to active_status = "${activeStatusValue}" (${results.skipped} already set)`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in bulk-update-pipedrive-active-status:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
