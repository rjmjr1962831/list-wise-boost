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
    const { agentName, brokerage, specialties, yearsExperience, zillowData } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the prompt
    const prompt = `Generate a professional and compelling bio for a real estate agent with the following details:

Name: ${agentName}
Brokerage: ${brokerage}
Specialties: ${specialties?.join(", ") || "General real estate"}
Years of Experience: ${yearsExperience || "Multiple years"}

${zillowData ? `Additional information from Zillow: ${JSON.stringify(zillowData)}` : ""}

The bio should be:
- Professional and engaging
- Highlight their expertise and specialties
- Be approximately 150-200 words
- Written in third person
- Focus on what makes them a great choice for clients

Generate only the bio text, no additional commentary.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a professional bio writer specializing in real estate agent profiles." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to generate bio");
    }

    const data = await response.json();
    const bio = data.choices[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ bio }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in generate-agent-bio:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
