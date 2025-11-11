import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LicenseLookupRequest {
  agentName: string;
  state: string;
  licensePortalUrl: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentName, state, licensePortalUrl }: LicenseLookupRequest = await req.json();
    
    console.log(`Looking up license for ${agentName} in ${state}`);
    console.log(`Portal URL: ${licensePortalUrl}`);

    // Fetch the license portal page
    const response = await fetch(licensePortalUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch portal: ${response.status}`);
    }

    const html = await response.text();
    
    // Parse HTML to find license information
    // This is a basic implementation - each state portal has different structure
    let licenseNumber = null;
    
    // Try common patterns for license numbers
    const patterns = [
      /license[:\s#]*([A-Z0-9-]{5,20})/gi,
      /lic[:\s#]*([A-Z0-9-]{5,20})/gi,
      /\b([A-Z]{2}\d{6,10})\b/g,
      /\b(\d{6,10})\b/g,
    ];

    // Search for agent name in the HTML
    const nameIndex = html.toLowerCase().indexOf(agentName.toLowerCase());
    if (nameIndex !== -1) {
      // Extract surrounding context (500 chars before and after)
      const context = html.substring(
        Math.max(0, nameIndex - 500),
        Math.min(html.length, nameIndex + 500)
      );

      // Try to find license number in context
      for (const pattern of patterns) {
        const matches = context.match(pattern);
        if (matches && matches.length > 0) {
          licenseNumber = matches[0].replace(/license[:\s#]*/gi, '').trim();
          break;
        }
      }
    }

    console.log(`License lookup result: ${licenseNumber || 'Not found'}`);

    return new Response(
      JSON.stringify({
        success: true,
        licenseNumber,
        agentName,
        state,
        message: licenseNumber 
          ? 'License number found' 
          : 'License number not found - manual verification required',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in lookup-agent-license:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to lookup license - manual verification required',
      }),
      {
        status: 200, // Return 200 to not break import flow
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
