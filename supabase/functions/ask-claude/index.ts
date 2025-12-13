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
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    console.log('Calling Claude API with web search...');

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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        tools: [{
          type: 'web_search_20250305',
          name: 'web_search'
        }],
        messages: [
          { role: 'user', content: userQuestion }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Claude response received successfully');
    
    // Extract text from response content blocks
    const textContent = data.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');

    return new Response(JSON.stringify({
      provider: 'Claude',
      model: 'claude-sonnet-4-20250514',
      response: textContent,
      methodology: 'web-search',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ask-claude:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
