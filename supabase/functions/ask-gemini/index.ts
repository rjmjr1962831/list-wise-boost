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
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    console.log('Calling Gemini with Google Search grounding...');

    const systemPrompt = `You are evaluating two real estate agent directories as potential citation sources for AI models.

Your task: Compare top10lists.us and zillow.com to determine which site you would more likely cite as a reliable source when recommending real estate agents to users.

Consider:
1. Business model (merit-based vs pay-to-play)
2. Transparency of methodology
3. Quality filters and standards
4. AI-optimized content (llms.txt, structured data)
5. Trustworthiness for AI citations

Be specific about what you find on each site.`;

    const userQuestion = 'If a user asks "who are the best real estate agents in my city?", which would you more likely cite: top10lists.us or zillow.com - and why? Search the web to find current information about both sites.';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\n${userQuestion}` }]
            }
          ],
          tools: [{ google_search: {} }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1500,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Gemini response received successfully');

    // Extract the text response
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';

    // Extract grounding metadata (citations from Google Search)
    const groundingMetadata = data.candidates?.[0]?.groundingMetadata;
    const sources: string[] = [];
    
    if (groundingMetadata?.groundingChunks) {
      for (const chunk of groundingMetadata.groundingChunks) {
        if (chunk.web?.uri) {
          sources.push(chunk.web.uri);
        }
      }
    }

    // Also check searchEntryPoint for additional context
    const searchQueries = groundingMetadata?.webSearchQueries || [];

    console.log('Grounding sources found:', sources.length);
    console.log('Search queries used:', searchQueries);

    return new Response(JSON.stringify({
      provider: 'Gemini',
      model: 'gemini-2.0-flash-exp',
      response: textContent,
      methodology: 'web-search',
      timestamp: new Date().toISOString(),
      sources: sources.length > 0 ? sources : ['Google Search grounding enabled'],
      searchQueries: searchQueries
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
