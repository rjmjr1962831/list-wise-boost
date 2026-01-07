const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// DISABLED: Prerender.io integration has been removed from this project
// This function now returns a message indicating it's disabled

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('prerender-recache called but Prerender.io is disabled');

  return new Response(
    JSON.stringify({ 
      message: 'Prerender.io integration is disabled',
      disabled: true 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
