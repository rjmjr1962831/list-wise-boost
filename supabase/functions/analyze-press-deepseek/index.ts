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
    const { professionalId, agentName, city, state } = await req.json();

    if (!professionalId) {
      return new Response(
        JSON.stringify({ error: 'professionalId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');

    if (!deepseekApiKey) {
      console.error('DEEPSEEK_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'DeepSeek API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the professional with raw Exa results
    const { data: professional, error: fetchError } = await supabase
      .from('professionals')
      .select('name, company, business_name, raw_scraper_data, press_mentions, description')
      .eq('id', professionalId)
      .single();

    if (fetchError || !professional) {
      console.error('Failed to fetch professional:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Professional not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract Exa results from raw_scraper_data
    const rawData = professional.raw_scraper_data as any;
    const exaResults = rawData?.exa_results || rawData?.searchResults || [];

    if (!exaResults || exaResults.length === 0) {
      console.log(`No Exa results found for ${professional.name}, skipping DeepSeek analysis`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No Exa results to analyze',
          pressCount: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🤖 [DeepSeek] Analyzing ${exaResults.length} results for ${professional.name}...`);

    // Prepare content for DeepSeek analysis
    const searchContent = exaResults.map((r: any, i: number) => 
      `[${i + 1}] ${r.title || 'Untitled'}\nURL: ${r.url}\n${r.text || r.snippet || ''}`
    ).join('\n\n---\n\n');

    const prompt = `You are analyzing web search results to find press mentions, awards, community involvement, and notable achievements for a real estate agent.

Agent: ${agentName || professional.name}
Company: ${professional.company || professional.business_name || 'Unknown'}
Location: ${city || 'Unknown'}, ${state || 'Unknown'}

Search Results:
${searchContent}

TASK: Extract ONLY verified press mentions and achievements that are CLEARLY about this specific agent. Be strict about name matching.

Return a JSON object with this structure:
{
  "press_mentions": [
    {
      "title": "Article or award title",
      "source": "Publication or organization name",
      "url": "Source URL",
      "date": "Date if available",
      "type": "award|media|community|publication|speaking",
      "summary": "Brief 1-2 sentence summary"
    }
  ],
  "confidence_notes": "Brief explanation of matching confidence"
}

Return ONLY the JSON object, no other text.`;

    // Call DeepSeek API
    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a precise data extraction assistant. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      console.error('DeepSeek API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'DeepSeek API error', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const deepseekData = await deepseekResponse.json();
    const responseContent = deepseekData.choices?.[0]?.message?.content || '';

    console.log(`📝 [DeepSeek] Raw response length: ${responseContent.length}`);

    // Parse the JSON response
    let extractedData: any = { press_mentions: [] };
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse DeepSeek response:', parseError);
      console.log('Raw response:', responseContent.slice(0, 500));
    }

    const pressMentions = extractedData.press_mentions || [];
    console.log(`✅ [DeepSeek] Extracted ${pressMentions.length} press mentions for ${professional.name}`);

    // Merge with existing press mentions (if any)
    const existingMentions = Array.isArray(professional.press_mentions) ? professional.press_mentions : [];
    const existingUrls = new Set(existingMentions.map((m: any) => m.url));
    
    const newMentions = pressMentions.filter((m: any) => !existingUrls.has(m.url));
    const mergedMentions = [...existingMentions, ...newMentions];

    // Update the professional record
    const { error: updateError } = await supabase
      .from('professionals')
      .update({
        press_mentions: mergedMentions,
        data_sources_log: {
          ...(professional.raw_scraper_data?.data_sources_log || {}),
          deepseek_analyzed_at: new Date().toISOString(),
          deepseek_mentions_found: pressMentions.length,
          deepseek_confidence: extractedData.confidence_notes
        }
      })
      .eq('id', professionalId);

    if (updateError) {
      console.error('Failed to update professional:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update professional', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        agentName: professional.name,
        pressCount: pressMentions.length,
        totalMentions: mergedMentions.length,
        newMentions: newMentions.length,
        confidence: extractedData.confidence_notes
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('analyze-press-deepseek error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
