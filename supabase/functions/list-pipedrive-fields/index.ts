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

    console.log('Fetching Pipedrive person fields...');

    // Fetch all person fields from Pipedrive
    const response = await fetch(
      `https://${pipedriveDomain}.pipedrive.com/api/v2/personFields?api_token=${pipedriveApiToken}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pipedrive API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    // Filter to custom fields and format nicely
    const customFields = data.data
      .filter((field: any) => field.edit_flag === true)
      .map((field: any) => ({
        key: field.key,
        name: field.name,
        field_type: field.field_type,
        options: field.options || []
      }));

    console.log(`Found ${customFields.length} custom person fields`);

    return new Response(
      JSON.stringify({
        success: true,
        fields: customFields,
        total: customFields.length
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
