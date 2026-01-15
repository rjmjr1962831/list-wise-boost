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
    const { contact } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const prompt = `Analyze this lead and provide a score from 0-100 with reasoning:

Contact Information:
- Name: ${contact.full_name}
- Email: ${contact.email}
- Phone: ${contact.phone || "Not provided"}
- Message: ${contact.message}

Provide a JSON response with:
- score (0-100)
- reasoning (brief explanation)
- priority (low/medium/high)
- recommended_actions (array of 2-3 next steps)`;

    console.log("Scoring lead:", contact.full_name);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are a lead scoring assistant. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Lovable AI error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;

    // Try to parse JSON from the response
    let result;
    try {
      // Handle potential markdown code blocks
      const jsonMatch = analysis.match(/```json\s*([\s\S]*?)\s*```/) || 
                        analysis.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, analysis];
      result = JSON.parse(jsonMatch[1] || analysis);
    } catch {
      // If not JSON, return raw analysis
      result = {
        score: 50,
        reasoning: analysis,
        priority: "medium",
        recommended_actions: ["Follow up with contact", "Review message details"],
      };
    }

    console.log("Lead scored:", result.score, result.priority);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in claude-score-lead:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
