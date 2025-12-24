const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecacheRequest {
  urls: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const prerenderToken = Deno.env.get('PRERENDER_TOKEN');
    
    if (!prerenderToken) {
      return new Response(
        JSON.stringify({ error: 'PRERENDER_TOKEN not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { urls } = await req.json() as RecacheRequest;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'urls array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Recaching ${urls.length} URLs on Prerender.io`);

    const results = [];

    for (const url of urls) {
      try {
        console.log(`Recaching: ${url}`);
        
        const response = await fetch('https://api.prerender.io/recache', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Prerender-Token': prerenderToken
          },
          body: JSON.stringify({ url })
        });

        const responseText = await response.text();
        
        results.push({
          url,
          success: response.ok,
          status: response.status,
          response: responseText
        });

        console.log(`${response.ok ? '✅' : '❌'} ${url}: ${response.status}`);
        
        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          url,
          success: false,
          error: errorMessage
        });
        console.error(`❌ ${url}: ${errorMessage}`);
      }
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`✅ Prerender recache complete: ${succeeded} succeeded, ${failed} failed`);

    return new Response(
      JSON.stringify({
        message: 'Prerender recache complete',
        succeeded,
        failed,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in prerender-recache:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
