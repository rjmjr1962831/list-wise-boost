import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const pipedriveApiToken = Deno.env.get('PIPEDRIVE_API_TOKEN');
    const pipedriveDomain = Deno.env.get('PIPEDRIVE_DOMAIN');

    if (!pipedriveApiToken || !pipedriveDomain) {
      throw new Error('Pipedrive credentials not configured');
    }

    console.log('Fetching Pipedrive person fields (v2 API)...');

    // Fetch all person fields from Pipedrive using v2 API with cursor pagination
    const allFields: any[] = [];
    let cursor: string | null = null;
    const limit = 100;

    do {
      const url = new URL(`https://${pipedriveDomain}.pipedrive.com/api/v2/personFields`);
      url.searchParams.set('api_token', pipedriveApiToken);
      url.searchParams.set('limit', String(limit));
      if (cursor) {
        url.searchParams.set('cursor', cursor);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pipedrive API error: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      if (data.success && data.data && data.data.length > 0) {
        // Map v2 response format to our expected structure
        for (const field of data.data) {
          allFields.push({
            id: field.id,
            key: field.key,
            name: field.name,
            field_type: field.field_type,
            options: field.options || [],
            is_custom: field.is_custom_flag ?? field.edit_flag ?? false,
          });
        }
        
        // v2 uses next_cursor for pagination
        cursor = data.additional_data?.next_cursor || null;
        console.log(`   Fetched ${allFields.length} fields so far...`);
      } else {
        cursor = null;
      }
    } while (cursor);

    console.log(`Found ${allFields.length} person fields`);

    return new Response(
      JSON.stringify({
        success: true,
        fields: allFields,
        total: allFields.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching Pipedrive fields:', error);
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
