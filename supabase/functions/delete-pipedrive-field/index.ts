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

    const { field_id } = await req.json();
    
    if (!field_id) {
      throw new Error('field_id (integer) is required');
    }

    console.log(`Deleting Pipedrive person field ID: ${field_id}`);

    // Delete person field from Pipedrive (v1 API) - requires integer ID
    const response = await fetch(
      `https://${pipedriveDomain}.pipedrive.com/api/v1/personFields/${field_id}?api_token=${pipedriveApiToken}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Pipedrive API error: ${JSON.stringify(data)}`);
    }

    console.log(`Successfully deleted field ID: ${field_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Field ID ${field_id} deleted successfully`,
        data: data.data,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error deleting Pipedrive field:', error);
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
