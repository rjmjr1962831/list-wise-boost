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
    const { cityName, citySlug, regenerate } = await req.json();
    
    if (!cityName || !citySlug) {
      return new Response(JSON.stringify({ error: 'cityName and citySlug required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if we already have generated content for this city
    if (!regenerate) {
      const { data: existing } = await supabase
        .from('marketing_content')
        .select('value')
        .eq('page', `city-${citySlug}`)
        .eq('section', 'market_overview')
        .eq('key', 'full_content')
        .single();

      if (existing?.value) {
        console.log(`Using cached content for ${cityName}`);
        return new Response(JSON.stringify({ content: JSON.parse(existing.value), cached: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Generate unique content using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = `Generate unique, SEO-optimized real estate market content for ${cityName}, Arizona. 

IMPORTANT: Make this content completely unique and specific to ${cityName}. Do NOT use generic phrases like "variety of housing options" or "growing community". Research actual facts about this specific city.

Return a JSON object with these fields:
{
  "overview": "2-3 sentences about what makes ${cityName} unique for homebuyers. Include specific landmarks, employers, or characteristics.",
  "highlights": ["4 specific bullet points about ${cityName} - mention real places, employers, schools, or attractions"],
  "neighborhoodTypes": ["4 types of housing/neighborhoods found specifically in ${cityName}"],
  "buyerProfile": "Who typically buys homes in ${cityName} and why",
  "marketTrends": "Current market conditions specific to ${cityName}"
}

Be specific and factual. If ${cityName} is a smaller city, mention its relationship to nearby larger cities. Avoid generic real estate language.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a real estate market analyst specializing in Arizona. Provide factual, specific information about Arizona cities. Always return valid JSON.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    let contentText = aiData.choices?.[0]?.message?.content || '';
    
    // Extract JSON from the response (may be wrapped in markdown code blocks)
    const jsonMatch = contentText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, contentText];
    contentText = jsonMatch[1].trim();
    
    let generatedContent;
    try {
      generatedContent = JSON.parse(contentText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', contentText);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Store the generated content in the database
    const { error: upsertError } = await supabase
      .from('marketing_content')
      .upsert({
        page: `city-${citySlug}`,
        section: 'market_overview',
        key: 'full_content',
        type: 'json',
        value: JSON.stringify(generatedContent),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'page,section,key'
      });

    if (upsertError) {
      console.error('Failed to cache content:', upsertError);
    }

    console.log(`Generated unique content for ${cityName}`);
    return new Response(JSON.stringify({ content: generatedContent, cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating city content:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
