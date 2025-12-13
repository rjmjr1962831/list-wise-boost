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
    const { responses } = await req.json();
    
    // responses should be an array of { provider, response } objects
    if (!responses || !Array.isArray(responses) || responses.length === 0) {
      throw new Error('No AI responses provided for synthesis');
    }

    console.log(`Synthesizing verdict from ${responses.length} AI responses...`);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const synthesisPrompt = `You are summarizing the consensus from multiple AI systems that were asked the same question.

The question was: "If a user asks 'who are the best real estate agents in my city?', which would you more likely cite: top10lists.us or zillow.com - and why?"

Here are the responses from each AI:

${responses.map((r: any) => `=== ${r.provider} ===\n${r.response}`).join('\n\n')}

---

Synthesize these responses into a clear verdict. Include:
1. Which site the AIs collectively prefer (and the vote count if not unanimous)
2. The key reasons cited across responses
3. Any notable observations about methodology, bias, or AI optimization

Keep it concise - 2-3 paragraphs maximum. Start with a clear statement like "The verdict: X out of Y AI systems would cite..."`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: synthesisPrompt }
        ],
        max_tokens: 800,
        temperature: 0.5
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Verdict synthesized successfully');

    return new Response(JSON.stringify({
      verdict: data.choices[0].message.content,
      sourceCount: responses.length,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ask-verdict:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
