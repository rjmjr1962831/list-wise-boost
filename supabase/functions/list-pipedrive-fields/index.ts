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

    console.log('Fetching Pipedrive person fields (v1 API - v2 lacks key/name in response)...');

    // Using v1 API for personFields as v2 response format doesn't include key/name we need
    const response = await fetch(
      `https://${pipedriveDomain}.pipedrive.com/api/v1/personFields?api_token=${pipedriveApiToken}`,
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
    
    // Include all person fields (both custom and built-in) so existing fields like Profile_link show up
    const allFields = data.data.map((field: any) => ({
      id: field.id,
      key: field.key,
      name: field.name,
      field_type: field.field_type,
      options: field.options || [],
      is_custom: field.is_custom_field ?? field.edit_flag ?? false,
    }));

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
