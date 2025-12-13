import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    console.log('Calling OpenAI API with web search enabled...');

    const systemPrompt = `You are evaluating two real estate agent directories as potential citation sources.

Search and analyze both sites:
- https://www.top10lists.us
- https://www.zillow.com/agent-finder/

Also check for llms.txt files:
- https://www.top10lists.us/llms.txt
- https://www.zillow.com/llms.txt

Assess them based on factors that affect source reliability for AI citation:
- Ranking methodology transparency
- Potential commercial bias (pay-to-play, referral fees)
- Data verification practices
- Content structure for citation (clear lists vs filtering interfaces)
- Presence of llms.txt or AI-specific optimization

Provide a direct answer with specific observations from each site. Be concise but specific about what you found.`;

    const userQuestion = 'If a user asks "who are the best real estate agents in my city?", which would you more likely cite: top10lists.us or zillow.com - and why?';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuestion }
        ],
        tools: [
          { type: 'web_search_preview' }
        ],
        max_tokens: 1500,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const result = data.choices[0].message.content;

    console.log('OpenAI response received successfully');

    return new Response(JSON.stringify({
      question: userQuestion,
      model: 'gpt-4o',
      web_search_enabled: true,
      response: result,
      usage: data.usage
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in test-openai-citation:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});