import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VERCEL_API_KEY = Deno.env.get('VERCEL_API_KEY');
    if (!VERCEL_API_KEY) {
      throw new Error('VERCEL_API_KEY is not configured');
    }

    const { message, history, systemContext } = await req.json();

    if (!message) {
      throw new Error('Message is required');
    }

    console.log('Chatbot request:', { message, historyLength: history?.length || 0 });

    // Build conversation messages in OpenAI format
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemContext || 'You are a helpful assistant.' }
    ];

    // Add conversation history
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
    }

    // Add current message
    messages.push({
      role: 'user',
      content: message
    });

    const response = await fetch('https://ai.gateway.vercel.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: messages,
        max_tokens: 800
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Vercel AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'Rate limit exceeded',
            response: "I'm getting a lot of questions right now. Please try again in a moment or call us at (602) 758-9600."
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: 'Payment required',
            response: "I apologize, but I'm temporarily unavailable. Please call us at (602) 758-9600 for immediate assistance."
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const assistantResponse = data.choices?.[0]?.message?.content;

    if (!assistantResponse) {
      throw new Error('No response from AI');
    }

    console.log('Chatbot response generated successfully');

    return new Response(
      JSON.stringify({ response: assistantResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Chatbot error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        response: "I apologize, but I'm having trouble right now. Please try again or call us at (602) 758-9600 for immediate assistance."
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
