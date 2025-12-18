import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PIPEDRIVE_API_TOKEN = Deno.env.get('PIPEDRIVE_API_TOKEN');
const PIPEDRIVE_DOMAIN = Deno.env.get('PIPEDRIVE_DOMAIN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Pipedrive Leads backfill...');

    if (!PIPEDRIVE_API_TOKEN || !PIPEDRIVE_DOMAIN) {
      throw new Error('Missing Pipedrive configuration');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch sync state records for ACTIVE professionals only
    const { data: syncRecords, error: fetchError } = await supabase
      .from('pipedrive_sync_state')
      .select('professional_id, pipedrive_person_id, professionals!inner(active)')
      .not('pipedrive_person_id', 'is', null)
      .eq('professionals.active', true);

    if (fetchError) {
      throw new Error(`Failed to fetch sync records: ${fetchError.message}`);
    }

    console.log(`Found ${syncRecords?.length || 0} professionals with Pipedrive Person IDs`);

    const results = {
      total: syncRecords?.length || 0,
      created: 0,
      alreadyExists: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const record of syncRecords || []) {
      try {
        const personId = record.pipedrive_person_id;

        // Check if Lead already exists for this person
        const searchUrl = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/leads?person_id=${personId}&api_token=${PIPEDRIVE_API_TOKEN}`;
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (searchData.data && searchData.data.length > 0) {
          // Lead already exists
          results.alreadyExists++;
          console.log(`Lead already exists for person ${personId}`);
        } else {
          // Need to get person details to create lead
          const personUrl = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/persons/${personId}?api_token=${PIPEDRIVE_API_TOKEN}`;
          const personResponse = await fetch(personUrl);
          const personData = await personResponse.json();

          if (!personData.success || !personData.data) {
            console.error(`Person ${personId} not found in Pipedrive`);
            results.failed++;
            results.errors.push(`Person ${personId} not found`);
            continue;
          }

          const person = personData.data;
          const orgId = person.org_id?.value || person.org_id || null;

          // Create Lead
          const createUrl = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/leads?api_token=${PIPEDRIVE_API_TOKEN}`;
          const leadPayload = {
            title: person.name || 'Unnamed Lead',
            person_id: personId,
            ...(orgId && { organization_id: orgId }),
          };

          const createResponse = await fetch(createUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(leadPayload),
          });

          const createData = await createResponse.json();

          if (createData.success) {
            results.created++;
            console.log(`Created Lead for person ${personId}: ${createData.data.id}`);
          } else {
            results.failed++;
            const errorMsg = createData.error || 'Unknown error';
            results.errors.push(`Person ${personId}: ${errorMsg}`);
            console.error(`Failed to create Lead for person ${personId}:`, errorMsg);
          }
        }

        // Rate limit: 100ms delay between requests (stays well under 100 req/10s)
        await delay(100);

      } catch (error: unknown) {
        results.failed++;
        const errMsg = error instanceof Error ? error.message : String(error);
        results.errors.push(`Person ${record.pipedrive_person_id}: ${errMsg}`);
        console.error(`Error processing person ${record.pipedrive_person_id}:`, error);
      }
    }

    console.log('Backfill complete:', results);

    return new Response(JSON.stringify({
      success: true,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Backfill error:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({
      success: false,
      error: errMsg,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
