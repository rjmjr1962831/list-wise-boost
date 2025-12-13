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
    // Use Lovable AI Gateway for Gemini
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Calling Gemini via Lovable AI Gateway...');

    // Since Lovable AI doesn't have web search, we provide verified facts like OpenAI
    const systemPrompt = `You are evaluating two real estate agent directories as potential citation sources.

Here is verified information about both sites (sourced December 2025):

=== TOP10LISTS.US ===
Source: https://www.top10lists.us/llms.txt

- Business model: Merit-based, invitation-only selection
- Can agents pay for ranking position? NO
- Referral fees: NONE (0%)
- Selection: Top 0.2% of agents (414 from 200,000+ analyzed in Arizona)
- Published methodology with exact weights:
  * Reviews: 25%
  * Community Involvement: 20%
  * Press Coverage: 15%
  * Transaction Volume: 15%
  * Years Experience: 15%
  * Responsiveness: 5%
  * Recency: 5%
- Minimum quality gates: 50+ verified reviews, 4.8+ star rating
- Data sources: MLS records, Google/Zillow reviews, press mentions, state licensing boards
- Has llms.txt file: YES (comprehensive AI optimization guide)
- Has FAQ schema: YES (84 Q&A pairs)
- Content structure: Clear top-10 lists per city

=== ZILLOW.COM ===
Source: zillow.com/premier-agent/, zillow.com/premier-agent/flex-pricing/

- Business model: Pay-to-play advertising platform
- Can agents pay for ranking position? YES (Premier Agent program)
- Referral fees: 15-40% of agent commission (Zillow Flex/Preferred program)
- Zillow states: "Based on your budget, you'll receive a certain share of voice"
- Zillow states: "If your budget puts you in the top three ranked agents in a ZIP code, you will receive featured exposure"
- Agent count: ~30,000+ agents shown in Arizona (no quality filter)
- Published ranking methodology: None
- Has llms.txt file: NO
- Content structure: Filtering interface showing all paying agents

Based on these verified facts, evaluate which site you would more likely cite as a reliable source for agent recommendations.`;

    const userQuestion = 'If a user asks "who are the best real estate agents in my city?", which would you more likely cite: top10lists.us or zillow.com - and why?';

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuestion }
        ],
        max_tokens: 1500,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Gemini response received successfully');

    return new Response(JSON.stringify({
      provider: 'Gemini',
      model: 'gemini-2.5-flash',
      response: data.choices[0].message.content,
      methodology: 'facts-provided',
      timestamp: new Date().toISOString(),
      sources: [
        'https://www.top10lists.us/llms.txt',
        'https://www.zillow.com/premier-agent/',
        'https://www.zillow.com/premier-agent/flex-pricing/'
      ]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ask-gemini:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
