import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contact, analysisType = "comprehensive" } = await req.json();
    
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    let prompt = "";
    
    if (analysisType === "sentiment") {
      prompt = `Analyze the sentiment and intent of this contact message:

From: ${contact.full_name}
Message: ${contact.message}

Provide:
- Sentiment (positive/neutral/negative)
- Intent (inquiry/complaint/feedback/request)
- Urgency level (low/medium/high)
- Key topics (array of topics)
- Suggested response approach`;
    } else {
      prompt = `Provide a comprehensive analysis of this contact:

Name: ${contact.full_name}
Email: ${contact.email}
Phone: ${contact.phone || "Not provided"}
Message: ${contact.message}

Analyze:
1. Communication style and professionalism
2. Level of interest/urgency
3. Potential pain points or needs
4. Best engagement strategy
5. Recommended timeline for follow-up

Provide insights in a structured format.`;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1536,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.content[0].text;

    return new Response(
      JSON.stringify({ 
        analysis,
        analysisType,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in claude-analyze-contact:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
